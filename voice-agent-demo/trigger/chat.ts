import { chat } from "@trigger.dev/sdk/ai";
import { stepCountIs, streamText } from "ai";
import { AGENT_ID, HISTORY_TURNS, MAX_REPLY_TOKENS, SYSTEM_PROMPT } from "../lib/voice-config";
import { chatModel } from "../lib/model";

export const voiceChat = chat.agent({
  id: AGENT_ID,
  // When the user goes quiet the run suspends and checkpoints; the next thing
  // they say resumes it. This keeps it warm for a couple of minutes first, so a
  // quick spoken follow-up doesn't pay a cold continuation boot.
  idleTimeoutInSeconds: 120,

  /**
   * Keep only the last few turns each turn, so input tokens stay flat and turn
   * latency doesn't grow with the conversation. A turn is a user message plus a
   * reply, so HISTORY_TURNS turns is up to twice that many messages.
   *
   * Anthropic rejects a conversation that doesn't begin with a user message, so
   * the window is walked forward to the first user message rather than sliced
   * blindly — a window that lands on an assistant message would be a 400.
   */
  prepareMessages: ({ messages }) => {
    const maxMessages = HISTORY_TURNS * 2;
    if (messages.length <= maxMessages) return messages;
    const windowed = messages.slice(-maxMessages);
    const firstUser = windowed.findIndex((m) => m.role === "user");
    return firstUser > 0 ? windowed.slice(firstUser) : windowed;
  },

  uiMessageStreamOptions: {
    // Whatever this returns is shown to the user (via useChat's `error`), so it
    // must never be the raw error — those carry keys and stack traces. Log the
    // real one, return plain prose.
    onError: (error) => {
      console.error("[voice-chat] stream error", error);
      const detail = error instanceof Error ? error.message : String(error);

      if (/rate limit|429/i.test(detail)) {
        return "I'm being rate limited. Give me a moment and ask again.";
      }
      if (/context_length|too many tokens/i.test(detail)) {
        return "This conversation has got too long. Start a new one and I'll keep up.";
      }
      if (/api key|authentication|401/i.test(detail)) {
        return "My model credentials aren't working. Check the server logs.";
      }
      if (/overloaded|529|503/i.test(detail)) {
        return "The model is overloaded right now. Try again in a moment.";
      }
      return "Something went wrong while I was answering. Try again.";
    },
  },
  run: async ({ messages, signal }) => {
    return streamText({
      // Spread first: wires up compaction, steering and telemetry.
      ...chat.toStreamTextOptions(),
      model: chatModel,
      system: SYSTEM_PROMPT,
      maxOutputTokens: MAX_REPLY_TOKENS,
      messages,
      abortSignal: signal,
      stopWhen: stepCountIs(1),
    });
  },
});
