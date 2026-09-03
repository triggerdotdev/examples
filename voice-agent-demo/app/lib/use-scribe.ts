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

/** Give up on a mic start if neither OPEN nor an error arrives in this long. */
const CONNECT_TIMEOUT_MS = 8000;

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
  const attempt = useRef(0); // bumps on stop/unmount to cancel an in-flight start

  // Latest callback without rebuilding the socket on every render.
  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;

  const start = useCallback(async (): Promise<boolean> => {
    // Guard the whole async connect, not just the initial check: `getToken()`
    // awaits, so two quick taps would otherwise both get past `connection.current`
    // (still null mid-connect) and open two microphone sockets.
    if (connection.current || starting.current) return false;
    starting.current = true;
    // Every start bumps the generation. stop()/unmount bump it too, so handlers
    // and the post-await checks can tell whether they still belong to the live
    // attempt — the client keeps delivering events after close(), and a token
    // can resolve after the user has moved on.
    const myAttempt = ++attempt.current;
    const active = () => myAttempt === attempt.current;
    setError(null);
    try {
      const token = await getToken();
      if (!active()) return false;

      // Resolve start() only once the mic is actually live: OPEN means the
      // socket connected AND getUserMedia succeeded. An error or an early close
      // resolves false, so a denied-permission start never reports success.
      let markReady!: (ok: boolean) => void;
      const ready = new Promise<boolean>((resolve) => (markReady = resolve));

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

      conn.on(RealtimeEvents.OPEN, () => {
        if (!active()) return;
        setConnected(true);
        markReady(true);
      });
      conn.on(RealtimeEvents.PARTIAL_TRANSCRIPT, (data) => {
        if (active()) setPartial(data.text);
      });
      conn.on(RealtimeEvents.COMMITTED_TRANSCRIPT, (data) => {
        if (!active()) return;
        setPartial("");
        const text = data.text.trim();
        if (text) onUtteranceRef.current(text);
      });
      for (const [event, message] of Object.entries(SCRIBE_ERRORS)) {
        conn.on(event as RealtimeEvents, () => {
          if (!active()) return;
          setError(message);
          markReady(false);
        });
      }
      // Anything not in the map above still needs to reach the user.
      conn.on(RealtimeEvents.ERROR, (data) => {
        if (!active()) return;
        setError(data?.error ?? "The microphone stream failed.");
        markReady(false);
      });
      conn.on(RealtimeEvents.INSUFFICIENT_AUDIO_ACTIVITY, () => {
        if (active()) setError("Didn't hear anything. Is the right microphone selected?");
      });
      conn.on(RealtimeEvents.CLOSE, () => {
        if (!active()) return;
        setConnected(false);
        setPartial("");
        if (connection.current === conn) connection.current = null;
        markReady(false); // closing before OPEN means the start failed
      });

      const timer = setTimeout(() => markReady(false), CONNECT_TIMEOUT_MS);
      const ok = await ready;
      clearTimeout(timer);

      // Failed or superseded: tear down the half-open connection.
      if (!ok || !active()) {
        conn.close();
        if (connection.current === conn) connection.current = null;
        return false;
      }
      return true;
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
      return false;
    } finally {
      starting.current = false;
    }
  }, [getToken]);

  const stop = useCallback(() => {
    attempt.current++; // cancel any start still awaiting its token
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

  useEffect(
    () => () => {
      attempt.current++; // cancel a start still awaiting its token
      connection.current?.close();
    },
    [],
  );

  const clearError = useCallback(() => setError(null), []);

  return { connected, partial, error, clearError, start, stop, setMuted };
}
