"use server";

import { auth } from "@trigger.dev/sdk";
import { chat } from "@trigger.dev/sdk/ai";

// Creates the Session row + triggers the first run, returns the session PAT.
// Idempotent on (env, chatId) so concurrent calls converge to the same session.
export const startChatSession = chat.createStartSessionAction("trigger-chat-agent");

// Pure mint — fresh session-scoped PAT for an existing session.
// The transport calls this on 401/403 to refresh.
//
// SECURITY: this is a server action, i.e. an unauthenticated public POST. It
// mints a read+write token for whatever `chatId` the caller passes, with no
// ownership check. `chatId` is an unguessable client-generated id, so the
// practical risk for a PUBLIC deployment is cost/abuse (anyone can start runs),
// not session theft. That cost is throttled by the agent's queue
// `concurrencyLimit` (see src/trigger/trigger-chat-agent.ts) and capped by an
// org spend limit set in the Trigger.dev dashboard (Billing). For a multi-user
// app, also resolve the signed-in user and verify they own `chatId`:
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
