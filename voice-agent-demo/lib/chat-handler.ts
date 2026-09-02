import { chat } from "@trigger.dev/sdk/chat-server";
import { streamText } from "ai";
import { AGENT_ID, MAX_REPLY_TOKENS, SYSTEM_PROMPT } from "./voice-config";
import { chatModel } from "./model";

/**
 * Head Start: runs turn 1's model call here, in the warm Next.js process,
 * while the agent run boots in parallel. Measured ~57% off first-turn
 * time-to-first-token. Turns 2+ bypass this route entirely and write straight
 * to the session.
 *
 * Don't set `stopWhen` — the spread pins it to stepCountIs(1), and overriding
 * it makes this handler run steps the agent is supposed to own.
 */
export const chatHandler = chat.headStart({
  agentId: AGENT_ID,
  run: async ({ chat: helper }) =>
    streamText({
      ...helper.toStreamTextOptions(),
      model: chatModel,
      system: SYSTEM_PROMPT,
      maxOutputTokens: MAX_REPLY_TOKENS,
    }),
});
