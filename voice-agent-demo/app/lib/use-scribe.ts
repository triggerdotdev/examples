"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CommitStrategy,
  RealtimeEvents,
  Scribe,
  type RealtimeConnection,
} from "@elevenlabs/client";
import { SCRIBE_MODEL, VAD_SILENCE_SECS } from "@/lib/voice-config";

/**
 * Scribe reports each refusal as its own event. Collapse them into messages
 * that say what to actually do about it — the raw payloads are opaque.
 */
const SCRIBE_ERRORS: Partial<Record<RealtimeEvents, string>> = {
  [RealtimeEvents.AUTH_ERROR]:
    "ElevenLabs rejected the microphone token. Check ELEVENLABS_API_KEY has speech-to-text permission.",
  [RealtimeEvents.QUOTA_EXCEEDED]:
    "ElevenLabs quota exhausted — no more transcription on this plan.",
  [RealtimeEvents.RATE_LIMITED]: "ElevenLabs rate-limited the microphone. Wait a moment.",
  [RealtimeEvents.UNACCEPTED_TERMS]: "This ElevenLabs account hasn't accepted the required terms.",
  [RealtimeEvents.SESSION_TIME_LIMIT_EXCEEDED]:
    "Transcription session hit its time limit. Tap the mic to start a fresh one.",
  [RealtimeEvents.RESOURCE_EXHAUSTED]: "ElevenLabs is out of capacity. Try again shortly.",
  [RealtimeEvents.TRANSCRIBER_ERROR]: "ElevenLabs failed to transcribe that audio.",
  [RealtimeEvents.QUEUE_OVERFLOW]:
    "Audio arrived faster than it could be transcribed; some was dropped.",
  [RealtimeEvents.CHUNK_SIZE_EXCEEDED]: "Audio chunk too large for the transcriber.",
  [RealtimeEvents.INPUT_ERROR]: "ElevenLabs rejected the audio format.",
};

/**
 * Mic -> text over ElevenLabs' realtime Scribe socket.
 *
 * Audio streams continuously and ElevenLabs' own VAD decides where an
 * utterance ends, which is the part the browser's SpeechRecognition was slow
 * at. Partials arrive while you're still talking; the committed transcript is
 * what we send as a turn.
 */
export function useScribe({
  getToken,
  onUtterance,
}: {
  getToken: () => Promise<string>;
  onUtterance: (text: string) => void;
}) {
  const [connected, setConnected] = useState(false);
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const connection = useRef<RealtimeConnection | null>(null);
  const starting = useRef(false); // true while connecting (covers the async gap)

  // Latest callback without rebuilding the socket on every render.
  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;

  const start = useCallback(async () => {
    // Guard the whole async connect, not just the initial check: `getToken()`
    // awaits, so two quick taps would otherwise both get past `connection.current`
    // (still null mid-connect) and open two microphone sockets.
    if (connection.current || starting.current) return;
    starting.current = true;
    setError(null);
    try {
      const token = await getToken();
      const conn = Scribe.connect({
        token,
        modelId: SCRIBE_MODEL,
        // Let the server decide where utterances end.
        commitStrategy: CommitStrategy.VAD,
        vadSilenceThresholdSecs: VAD_SILENCE_SECS,
        noVerbatim: true, // drop "um", false starts
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      connection.current = conn;

      conn.on(RealtimeEvents.OPEN, () => setConnected(true));
      conn.on(RealtimeEvents.PARTIAL_TRANSCRIPT, (data) => setPartial(data.text));
      conn.on(RealtimeEvents.COMMITTED_TRANSCRIPT, (data) => {
        setPartial("");
        const text = data.text.trim();
        if (text) onUtteranceRef.current(text);
      });
      for (const [event, message] of Object.entries(SCRIBE_ERRORS)) {
        conn.on(event as RealtimeEvents, () => setError(message));
      }
      // Anything not in the map above still needs to reach the user.
      conn.on(RealtimeEvents.ERROR, (data) =>
        setError(data?.error ?? "The microphone stream failed."),
      );
      conn.on(RealtimeEvents.INSUFFICIENT_AUDIO_ACTIVITY, () =>
        setError("Didn't hear anything. Is the right microphone selected?"),
      );
      conn.on(RealtimeEvents.CLOSE, () => {
        setConnected(false);
        setPartial("");
        if (connection.current === conn) connection.current = null;
      });
    } catch (cause) {
      // Covers a failed token mint (missing/underscoped key) and a denied
      // getUserMedia prompt, which are the two most likely first-run failures.
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(
        /permission|denied|NotAllowed/i.test(message)
          ? "Microphone access was blocked. Allow it in the browser and tap again."
          : message,
      );
      connection.current = null;
    } finally {
      starting.current = false;
    }
  }, [getToken]);

  const stop = useCallback(() => {
    connection.current?.close();
    connection.current = null;
    setConnected(false);
    setPartial("");
  }, []);

  /**
   * Mute rather than disconnect while the assistant is talking, so the mic
   * doesn't transcribe our own audio out of the speakers. Cheaper than
   * tearing the socket down and rebuilding it every turn.
   */
  const setMuted = useCallback((muted: boolean) => {
    const conn = connection.current;
    if (!conn) return;
    if (muted && !conn.isMuted) conn.mute();
    if (!muted && conn.isMuted) conn.unmute();
  }, []);

  useEffect(() => () => connection.current?.close(), []);

  const clearError = useCallback(() => setError(null), []);

  return { connected, partial, error, clearError, start, stop, setMuted };
}
