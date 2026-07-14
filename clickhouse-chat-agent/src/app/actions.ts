"use server";

import { auth } from "@trigger.dev/sdk";
import { chat } from "@trigger.dev/sdk/ai";

// Creates the Session row + triggers the first run, returns the session PAT.
// Idempotent on (env, chatId) so concurrent calls converge to the same session.
export const startChatSession = chat.createStartSessionAction("clickhouse-agent");

// Pure mint — fresh session-scoped PAT for an existing session.
// The transport calls this on 401/403 to refresh.
export async function mintChatAccessToken(chatId: string) {
  return auth.createPublicToken({
    scopes: {
      read: { sessions: chatId },
      write: { sessions: chatId },
    },
    expirationTime: "1h",
  });
}
