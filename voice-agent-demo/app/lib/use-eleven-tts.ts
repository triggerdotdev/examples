"use client";

import { useCallback, useRef, useState } from "react";
import {
  TTS_MODEL,
  TTS_OUTPUT_FORMAT,
  TTS_SAMPLE_RATE,
  TTS_SCHEDULE_LEAD_SECONDS,
  TTS_VOICE_ID,
  TTS_VOICE_SETTINGS,
} from "@/lib/voice-config";

const WS_BASE = "wss://api.elevenlabs.io/v1/text-to-speech";

/**
 * Smallest slice of text worth sending on its own.
 *
 * Model deltas arrive a few characters at a time, so forwarding them raw ships
 * fragments — including a lone "." or "," that lands *after* the audio for the
 * words it modifies was already generated. That's what makes punctuation sound
 * wrong. Buffering to a word or clause boundary keeps punctuation attached to
 * the text it belongs to, and is still far short of waiting for a sentence.
 */
const MIN_CHUNK_CHARS = 45;

/** Sentence-ending punctuation, optionally wrapped in a closing quote/bracket. */
const SENTENCE_END = /[.!?][")\]]?(?=\s|$)/;

function decodePcm(base64: string): Float32Array<ArrayBuffer> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  // 16-bit signed little-endian mono.
  const samples = new Float32Array(new ArrayBuffer((bytes.byteLength / 2) * 4));
  for (let i = 0; i < samples.length; i++) {
    samples[i] = view.getInt16(i * 2, true) / 32768;
  }
  return samples;
}

/**
 * Streaming text-to-speech over ElevenLabs' `stream-input` socket.
 *
 * Text goes in as the model produces it and PCM comes back in chunks, which we
 * schedule sample-accurately through Web Audio. Nothing waits for a sentence to
 * finish, so first audio lands as soon as Flash has something to say.
 *
 * The socket opens **lazily**, on the first chunk of real text — not when the
 * turn starts. That matters: the stream-input socket times out if it sits ~20s
 * with no input, so a turn that produces no text (the user barges in, or a reply
 * is dropped) must never open one. `arm()` holds the token; the socket appears
 * only once there's something to say, and is always closed by `finish()`.
 */
export function useElevenTts() {
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // How text flows: push() buffers into `outbox` until there's a whole word or
  // sentence, then send() ships that chunk to the socket (or holds it in
  // `pending` if the socket is still connecting). Audio comes back and play()
  // schedules it through Web Audio.
  const token = useRef<string | null>(null); // token for the next turn's socket
  const socket = useRef<WebSocket | null>(null);
  const outbox = useRef(""); // buffered text, not yet at a word/sentence boundary
  const pending = useRef<string[]>([]); // chunks ready to send, awaiting socket OPEN
  const finishWhenOpen = useRef(false); // finish() was called before the socket opened

  // Web Audio playback state.
  const ctx = useRef<AudioContext | null>(null);
  const playing = useRef(new Set<AudioBufferSourceNode>()); // chunks currently scheduled
  const cursor = useRef(0); // when the next chunk should start, on the audio clock

  /** Must be called from a user gesture — browsers won't start audio otherwise. */
  const unlock = useCallback(() => {
    try {
      ctx.current ??= new AudioContext();
      if (ctx.current.state === "suspended") void ctx.current.resume();
      return true;
    } catch {
      setError("This browser wouldn't start audio playback.");
      return false;
    }
  }, []);

  const play = useCallback((samples: Float32Array<ArrayBuffer>) => {
    const audio = ctx.current;
    if (!audio || samples.length === 0) return;

    // Browsers can suspend the AudioContext after inactivity or on tab blur.
    // Scheduling into a suspended context produces no sound and no error, so
    // resume it here — otherwise audio silently stops partway through a session.
    if (audio.state === "suspended") void audio.resume();

    const buffer = audio.createBuffer(1, samples.length, TTS_SAMPLE_RATE);
    buffer.copyToChannel(samples, 0);

    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.destination);

    // Keep the cursor ahead of the clock; if we've underrun, restart from now.
    const startAt = Math.max(cursor.current, audio.currentTime + TTS_SCHEDULE_LEAD_SECONDS);
    source.start(startAt);
    cursor.current = startAt + buffer.duration;

    playing.current.add(source);
    setSpeaking(true);
    source.onended = () => {
      playing.current.delete(source);
      if (playing.current.size === 0) setSpeaking(false);
    };
  }, []);

  /** Open the socket using the armed token. Called lazily from `send`. */
  const openSocket = useCallback(() => {
    if (socket.current) return socket.current;
    if (!token.current || !unlock()) return null;
    cursor.current = 0;

    const params = new URLSearchParams({
      model_id: TTS_MODEL,
      output_format: TTS_OUTPUT_FORMAT,
      // Generate as soon as there's something to say rather than waiting to
      // fill a buffer. This is the latency setting that matters.
      auto_mode: "true",
      single_use_token: token.current,
    });
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${WS_BASE}/${TTS_VOICE_ID}/stream-input?${params}`);
    } catch {
      setError("Couldn't open the speech socket.");
      return null;
    }
    socket.current = ws;
    token.current = null; // single-use: this token is spent on the socket above
    setError(null);

    ws.onopen = () => {
      // ElevenLabs' stream-input protocol wants an initial frame carrying the
      // voice settings; a single space primes the stream without speaking.
      ws.send(JSON.stringify({ text: " ", voice_settings: TTS_VOICE_SETTINGS }));
      for (const text of pending.current) ws.send(JSON.stringify({ text }));
      pending.current = [];
      if (finishWhenOpen.current) {
        finishWhenOpen.current = false;
        ws.send(JSON.stringify({ text: "" }));
      }
    };

    ws.onmessage = (event) => {
      let message: { audio?: string; error?: string; message?: string };
      try {
        message = JSON.parse(event.data as string);
      } catch {
        return; // not JSON — nothing we can do with it
      }
      if (message.audio) {
        try {
          play(decodePcm(message.audio));
        } catch {
          setError("Received audio that couldn't be decoded.");
        }
      } else if (message.error) {
        // ElevenLabs reports refusals in-band before closing.
        setError(`${message.error}: ${message.message ?? ""}`.trim());
      }
    };

    ws.onerror = () => setError("Speech socket failed to connect.");

    ws.onclose = (event) => {
      if (socket.current === ws) socket.current = null;
      // 1000 (normal) and 1005 (no status) are clean closes; anything else
      // means we never got audio and the reason is the only clue we get.
      if (event.code !== 1000 && event.code !== 1005) {
        setError(
          (prev) =>
            prev ?? `Speech socket closed (${event.code}): ${event.reason || "no reason given"}`,
        );
      }
    };

    return ws;
  }, [play, unlock]);

  /** Hand one chunk to the socket, opening it lazily if this is the first text. */
  const send = useCallback(
    (text: string) => {
      const body = text.trimStart();
      if (!body) return;
      // ElevenLabs' own examples end every chunk with a space; without it
      // consecutive chunks run together into one word.
      const chunk = body.endsWith(" ") ? body : `${body} `;
      const ws = socket.current ?? openSocket();
      if (!ws) return; // no socket and no token to open one — nothing to send to
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ text: chunk }));
      else pending.current.push(chunk); // still connecting — flushed on open
    },
    [openSocket],
  );

  /**
   * Arm the socket for a turn: hold the token and reset per-turn state, but
   * don't open anything yet. The socket appears on the first `push` that has
   * real text, so a turn that stays silent never opens one.
   */
  const arm = useCallback(
    (freshToken: string) => {
      if (!unlock()) return;
      token.current = freshToken;
      outbox.current = "";
      pending.current = [];
      finishWhenOpen.current = false;
    },
    [unlock],
  );

  /** Buffer model output, releasing it at boundaries rather than per delta. */
  const push = useCallback(
    (text: string) => {
      if (!text) return;
      outbox.current += text;

      for (;;) {
        const buffered = outbox.current;

        // A finished sentence is always worth sending immediately.
        const sentence = buffered.match(SENTENCE_END);
        if (sentence?.index !== undefined) {
          const cut = sentence.index + sentence[0].length;
          outbox.current = buffered.slice(cut).trimStart();
          send(buffered.slice(0, cut));
          continue;
        }

        // Otherwise wait for enough text, then break on the last word boundary
        // so we never split mid-word.
        if (buffered.length < MIN_CHUNK_CHARS) return;
        const boundary = buffered.lastIndexOf(" ");
        if (boundary <= 0) return;
        outbox.current = buffered.slice(boundary + 1);
        send(buffered.slice(0, boundary));
      }
    },
    [send],
  );

  /** No more text this turn — flush the tail, then let the socket drain. */
  const finish = useCallback(() => {
    if (outbox.current.trim()) send(outbox.current);
    outbox.current = "";

    const ws = socket.current;
    // An empty-string frame is the stream-input end-of-input sentinel: it tells
    // ElevenLabs to flush and close once the buffered text has been spoken. If
    // no socket ever opened (a silent turn), there's nothing to close — just
    // disarm so a later turn opens fresh.
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ text: "" }));
    else if (ws) finishWhenOpen.current = true; // still connecting
    else token.current = null;
  }, [send]);

  /**
   * Speak one self-contained line from a standing start — arm, say it, close.
   * Used by the idle farewell, which isn't part of a model turn.
   */
  const say = useCallback(
    (freshToken: string, text: string) => {
      arm(freshToken);
      push(text);
      finish();
    },
    [arm, push, finish],
  );

  /** Stop playback and close the socket immediately (Interrupt, or a new turn). */
  const stop = useCallback(() => {
    token.current = null;
    pending.current = [];
    outbox.current = "";
    finishWhenOpen.current = false;
    for (const source of playing.current) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // already finished
      }
    }
    playing.current.clear();
    cursor.current = 0;
    setSpeaking(false);

    // Detach handlers before closing: this is a deliberate barge-in close, and
    // an aborted socket reports code 1006, which onclose would otherwise report
    // as an error.
    const ws = socket.current;
    if (ws) {
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      ws.close();
    }
    socket.current = null;
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { speaking, error, clearError, arm, push, finish, say, stop, unlock };
}
