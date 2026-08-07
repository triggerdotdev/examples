"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@trigger.dev/sdk";
import { chat } from "@trigger.dev/sdk/ai";
import { deleteChat as deleteChatRow } from "@/lib/db/queries";
import { getUserId } from "@/lib/user";

// Creates the Session row + triggers the first run, returns the session PAT.
// Idempotent on (env, chatId) so concurrent calls converge to the same session.
export const startChatSession = chat.createStartSessionAction("trigger-chat-agent");

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

/** Delete a conversation. Scoped to the caller's own id, read server-side. */
export async function deleteChat(chatId: string) {
  const userId = await getUserId();
  if (!userId) return;
  await deleteChatRow(chatId, userId);
  revalidatePath("/", "layout");
}
