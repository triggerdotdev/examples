"use server";

import { auth } from "@trigger.dev/sdk";
import { chat } from "@trigger.dev/sdk/ai";

// Creates the chat session and triggers the first agent run
export const startChatSession = chat.createStartSessionAction("research-agent");

// The transport calls this to get a session-scoped token, and again when it expires
export async function mintChatAccessToken(chatId: string) {
  return auth.createPublicToken({
    scopes: {
      read: { sessions: chatId },
      write: { sessions: chatId },
    },
    expirationTime: "1h",
  });
}
