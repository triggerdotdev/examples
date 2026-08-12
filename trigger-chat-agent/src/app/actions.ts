"use server";

import { auth } from "@trigger.dev/sdk";
import { chat } from "@trigger.dev/sdk/ai";

// Creates the Session row + triggers the first run, returns the session PAT.
// Idempotent on (env, chatId) so concurrent calls converge to the same session.
export const startChatSession = chat.createStartSessionAction("trigger-chat-agent");

// Pure mint — fresh session-scoped PAT for an existing session.
// The transport calls this on 401/403 to refresh.
//
// SECURITY: this is a server action, i.e. a public POST endpoint. It mints a
// read+write token for whatever `chatId` the caller passes, with no ownership
// check — fine for this anonymous single-user demo, but a session-hijack hole
// in a multi-user app. Before shipping, resolve the signed-in user and verify
// they own `chatId` first, e.g.:
//   const user = await getCurrentUser();
//   if (!user || !(await userOwnsSession(user.id, chatId))) throw new Error("Forbidden");
export async function mintChatAccessToken(chatId: string) {
  return auth.createPublicToken({
    scopes: {
      read: { sessions: chatId },
      write: { sessions: chatId },
    },
    expirationTime: "1h",
  });
}
