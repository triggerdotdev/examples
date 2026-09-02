"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { useTriggerChatTransport } from "@trigger.dev/sdk/chat/react";
import type { voiceChat } from "@/trigger/chat";
import {
  mintChatAccessToken,
  mintScribeToken,
  mintTtsToken,
  startChatSession,
} from "@/app/actions";
import { AGENT_ID, IDLE_FAREWELL_MS, IDLE_FAREWELL_TEXT } from "@/lib/voice-config";
import { useScribe } from "@/app/lib/use-scribe";
import { useElevenTts } from "@/app/lib/use-eleven-tts";

function textOf(message: { parts: Array<{ type: string }> }) {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function VoiceChat() {
  const transport = useTriggerChatTransport<typeof voiceChat>({
    task: AGENT_ID,
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) => startChatSession({ chatId, clientData }),
    // Turn 1's model call runs in the Next.js process while the agent boots.
    headStart: "/api/chat",
  });

  const {
    messages,
    sendMessage,
    stop,
    status,
    error: chatError,
    id: chatId,
  } = useChat({ transport });

  // Stop the in-flight turn: signal the running agent and update the local UI.
  // Awaiting the signal means it lands before any message we send next.
  const stopTurn = useCallback(async () => {
    try {
      await transport.stopGeneration(chatId);
    } catch {
      // best-effort — the turn will still complete on its own
    }
    stop();
  }, [transport, chatId, stop]);
  const [live, setLive] = useState(false);

  const tts = useElevenTts();

  const [sendError, setSendError] = useState<string | null>(null);
  const [pendingText, setPendingText] = useState<string | null>(null);

  const onUtterance = useCallback(
    async (text: string) => {
      tts.stop(); // clear any audio still playing from a previous turn
      setSendError(null);

      // Mint the speech token while the model is still thinking, so it's ready
      // the moment the first reply text arrives. The socket itself opens lazily
      // on that first text (see useElevenTts). A broken speaker shouldn't cost
      // you the answer on screen, so failures here don't block the turn.
      try {
        tts.arm(await mintTtsToken());
      } catch (cause) {
        setSendError(
          cause instanceof Error ? `Speech unavailable: ${cause.message}` : "Speech unavailable.",
        );
      }

      // Queue the text; the effect below sends it once useChat is "ready".
      // Utterances spoken during a reply wait their turn rather than
      // interrupting — cutting a reply short is the Interrupt button's job.
      // (Calling sendMessage mid-turn races useChat's status and wedges the UI.)
      setPendingText(text);
    },
    [tts],
  );

  const scribe = useScribe({ getToken: mintScribeToken, onUtterance });

  const last = messages[messages.length - 1];
  const streaming = status === "streaming" || status === "submitted";

  // Keep the transcript pinned to the newest message as it grows.
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastText = last ? textOf(last) : "";
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, lastText, scribe.partial]);

  // Send a queued utterance only once useChat is ready, never mid-turn.
  useEffect(() => {
    if (!pendingText || status !== "ready") return;
    setPendingText(null);
    try {
      sendMessage({ text: pendingText });
    } catch (cause) {
      setSendError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [pendingText, status, sendMessage]);
  // Speak assistant text as it streams in. `spokenUpTo` remembers how far into
  // each message we've already sent, so we only push the newly-arrived slice.
  const spokenUpTo = useRef(new Map<string, number>());
  useEffect(() => {
    if (!last || last.role !== "assistant") return;
    const text = textOf(last);
    const from = spokenUpTo.current.get(last.id) ?? 0;
    if (text.length > from) {
      spokenUpTo.current.set(last.id, text.length);
      tts.push(text.slice(from));
    }
  }, [last, tts]);

  // Close out the turn once the model stops.
  const wasStreaming = useRef(false);
  useEffect(() => {
    if (wasStreaming.current && !streaming) {
      tts.finish();
    }
    wasStreaming.current = streaming;
  }, [streaming, tts, last]);

  // Lock the mic for the whole turn — while the agent is thinking (so a pause
  // in your sentence isn't committed as a second turn) and while it's speaking
  // (so we don't transcribe our own audio). It reopens when the reply is done
  // and we're back to listening. Cutting a reply short is the Interrupt button.
  useEffect(() => {
    scribe.setMuted(streaming || tts.speaking);
  }, [streaming, tts.speaking, scribe]);

  const stopListening = useCallback(() => {
    scribe.stop();
    tts.stop();
    setLive(false);

    // If a turn is mid-flight, stop it — otherwise the agent keeps generating
    // server-side after the UI has gone quiet. We deliberately do NOT end the
    // run: leaving it lets the agent suspend and checkpoint, so the next thing
    // the user says resumes the same conversation cheaply. Ending it here would
    // throw that checkpoint away and make the next turn pay a cold boot.
    if (streaming) void stopTurn();
  }, [scribe, tts, streaming, stopTurn]);

  /**
   * If nobody says anything for a while, say goodbye and release the mic.
   *
   * Armed only once the assistant has actually spoken — otherwise opening the
   * page and pausing to think would get you dismissed. Any of the dependencies
   * changing (you start talking, a turn begins, audio plays) re-runs this and
   * clears the pending timer, so the countdown only advances during real
   * silence.
   */
  const [farewell, setFarewell] = useState<string | null>(null);
  const hasSpoken = messages.some((m) => m.role === "assistant");
  const busy = streaming || tts.speaking || scribe.partial.length > 0;

  useEffect(() => {
    if (!live || busy || !hasSpoken) return;

    const timer = setTimeout(async () => {
      setFarewell(IDLE_FAREWELL_TEXT);
      try {
        await tts.say(await mintTtsToken(), IDLE_FAREWELL_TEXT);
      } catch {
        // Saying goodbye is best-effort; still release the mic below.
      }
      stopListening();
    }, IDLE_FAREWELL_MS);

    return () => clearTimeout(timer);
  }, [live, busy, hasSpoken, tts, stopListening]);

  const toggle = useCallback(async () => {
    if (live) {
      stopListening();
    } else {
      tts.unlock(); // audio needs a user gesture
      setFarewell(null);
      await scribe.start();
      setLive(true);
    }
  }, [live, stopListening, scribe, tts]);

  // Mic first: without it there's no input at all. Then the agent, then audio
  // out, which is the only one you can still hold a conversation without.
  const problem = scribe.error ?? sendError ?? chatError?.message ?? tts.error;

  const dismiss = useCallback(() => {
    scribe.clearError();
    tts.clearError();
    setSendError(null);
  }, [scribe, tts]);

  function statusLabel() {
    if (farewell) return farewell;
    if (!live) return "Tap to start";
    if (tts.speaking) return "Speaking…";
    if (streaming) return "Thinking…";
    return "Listening…";
  }

  return (
    <div className="flex h-dvh flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
        <h1 className="font-medium">Voice Agent</h1>
        <span className="text-xs uppercase tracking-wide text-neutral-500">
          {scribe.connected ? "mic live" : "mic off"}
        </span>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {messages.length === 0 && <p className="text-neutral-500">Tap the mic and talk.</p>}
        {messages.map((message) => (
          <div key={message.id} className="max-w-2xl">
            <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">
              {message.role === "user" ? "You" : "Assistant"}
            </div>
            <div className="whitespace-pre-wrap leading-relaxed">{textOf(message)}</div>
          </div>
        ))}
        {scribe.partial && (
          <div className="max-w-2xl italic text-neutral-500">{scribe.partial}</div>
        )}
      </div>

      <footer className="flex flex-col items-center gap-3 border-t border-neutral-800 px-6 py-6">
        {problem ? (
          <div className="flex max-w-xl flex-col items-center gap-2">
            <p className="text-center text-sm text-red-400">{problem}</p>
            <button
              type="button"
              onClick={dismiss}
              className="text-xs text-neutral-500 underline hover:text-neutral-300"
            >
              Dismiss
            </button>
          </div>
        ) : (
          <p className="text-sm text-neutral-400">{statusLabel()}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            className={`h-16 w-16 rounded-full text-2xl transition ${
              live ? "bg-red-600" : "bg-neutral-800 hover:bg-neutral-700"
            } ${scribe.connected && !tts.speaking && !streaming ? "animate-pulse" : ""}`}
            aria-label={live ? "Stop" : "Start talking"}
          >
            {live ? "◼" : "🎙"}
          </button>

          {(streaming || tts.speaking) && (
            <button
              type="button"
              onClick={() => {
                // Always stop the audio. Only stop generation if the model is
                // still streaming — sending a stop into an already-finished turn
                // poisons the session's stream and wedges the next turn.
                tts.stop();
                if (streaming) void stopTurn();
              }}
              className="rounded-full border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800"
            >
              Interrupt
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
