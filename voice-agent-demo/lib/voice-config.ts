// Shared between the agent task and the head-start route handler.
// Keep this file free of heavy imports — anything here lands in the
// route-handler bundle, and Head Start only pays off while that stays light.

export const AGENT_ID = "voice-chat";

// Same model on both sides of the handover, or the voice audibly changes
// character mid-sentence when step 1 hands off to the agent.
export const CHAT_MODEL = "claude-haiku-4-5";

/**
 * A plain, useful voice assistant.
 *
 * Two constraints carry real weight and shouldn't be relaxed:
 *
 * 1. Replies stay short. Every reply is synthesised and read aloud, so a long
 *    one costs seconds of dead air.
 * 2. Punctuation and number formatting follow ElevenLabs' Flash v2.5 guidance —
 *    standard punctuation drives natural rhythm, while ellipses and dashes are
 *    read unpredictably and capitals-for-emphasis destabilises the voice. Flash
 *    also normalises numbers and currency less reliably than the larger models,
 *    so the model is asked to spell them out itself.
 */
export const SYSTEM_PROMPT = `You are a helpful voice assistant. You're warm,
direct and quick.

Your replies are read aloud by a speech synthesiser, so:

- Keep answers to one or two sentences unless asked for more. If a question
  needs a long answer, give the headline first and offer to go deeper.
- Write plain spoken prose. No markdown, no bullet points, no code blocks,
  no emoji, no URLs, no asterisks.
- Use only full stops, commas and question marks. Avoid ellipses, em-dashes
  and semicolons: they're read unpredictably.
- Never use capitals for emphasis. Put the emphasis in the wording.
- Spell numbers, money and units out the way you'd say them: "twenty five
  percent", not "25%"; "nineteen ninety nine", not "£19.99".
- If you don't know something, say so plainly rather than guessing.`;

// --- Model tuning ------------------------------------------------------

/**
 * Hard ceiling on reply length.
 *
 * The prompt asks for one or two sentences and usually gets them, but the model
 * doesn't know that when it starts generating — so a bad sample can run long
 * and drag the turn out. This bounds the worst case. Comfortably above a normal
 * two-sentence reply, so it should almost never bind; if it does, the reply gets
 * cut mid-sentence, which is worse than a slow one. Don't lower it without
 * listening to the result.
 */
export const MAX_REPLY_TOKENS = 100;

/**
 * How many recent turns (a user message plus the assistant's reply) to send to
 * the model each turn.
 *
 * Keeps input tokens flat instead of growing, so turn latency stays predictable
 * however long the conversation runs.
 *
 * The cost is real: the assistant genuinely cannot remember anything past this
 * many turns, so it will lose earlier context in a long conversation. Raise it
 * if you need memory more than you need flat latency. And because the trimmed
 * prefix changes every turn, byte-exact prompt caching can never hit — the two
 * techniques are mutually exclusive.
 */
export const HISTORY_TURNS = 3;

// --- Voice I/O ---------------------------------------------------------

export const SCRIBE_MODEL = "scribe_v2_realtime";

/**
 * Voice id. Set NEXT_PUBLIC_TTS_VOICE_ID to any voice on your ElevenLabs
 * account; the default is the stock "Roger" premade voice.
 */
export const TTS_VOICE_ID = process.env.NEXT_PUBLIC_TTS_VOICE_ID ?? "CwhRBWXzGAHq8TQ4Fs17";

/** Passed to ElevenLabs on the first frame. Tune to taste. */
export const TTS_VOICE_SETTINGS = { stability: 0.4, similarity_boost: 0.75 };

/**
 * How far ahead of the audio clock to schedule each PCM chunk. A small lead
 * absorbs jitter between chunks without an audible gap. Seconds.
 */
export const TTS_SCHEDULE_LEAD_SECONDS = 0.02;
export const TTS_MODEL = "eleven_flash_v2_5";

/**
 * Raw PCM out of ElevenLabs, played through Web Audio. MP3 chunks would need
 * MediaSource and buffer awkwardly; PCM we can schedule sample-accurately.
 */
export const TTS_SAMPLE_RATE = 24000;
export const TTS_OUTPUT_FORMAT = `pcm_${TTS_SAMPLE_RATE}`;

/**
 * How long ElevenLabs' VAD waits on silence before committing a transcript.
 * This is the single biggest knob on how snappy the thing feels — lower means
 * it cuts you off mid-thought, higher means dead air. Range is 0.3–3.0.
 */
export const VAD_SILENCE_SECS = 1;

/**
 * How long to sit in silence before assuming you've wandered off. Counted only
 * while the mic is live and neither side is mid-turn.
 */
export const IDLE_FAREWELL_MS = 30_000;

/**
 * Said on that timeout. A fixed line rather than a model call: it's faster,
 * costs nothing, and the model can't decide to paraphrase it.
 */
export const IDLE_FAREWELL_TEXT =
  "Sounds like you have gone. Say something when you need me again.";
