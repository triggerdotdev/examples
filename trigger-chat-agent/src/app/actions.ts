"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@trigger.dev/sdk";
import { chat } from "@trigger.dev/sdk/ai";
import { closeChat, ownerTag } from "@/lib/chats";
import { getUserId } from "@/lib/user";

const startSession = chat.createStartSessionAction("trigger-chat-agent");

/**
 * Creates the Session + triggers the first run, returns the session PAT.
 * Idempotent on (env, chatId) so concurrent calls converge to the same session.
 *
 * Owner and title are set here, at creation — the only chance, since
 * `sessions.update()` requires a secret key. The owner is read from the cookie
 * server-side rather than taken from the client, so a caller can't claim someone
 * else's chats. `title` is the question being asked, passed through by the client.
 */
export async function startChatSession({
  chatId,
  clientData,
  title,
}: {
  chatId: string;
  clientData?: { userId: string };
  title?: string;
}) {
  const userId = (await getUserId()) ?? clientData?.userId;
  const trimmed = title?.trim();

  return startSession({
    chatId,
    clientData: userId ? { userId } : clientData,
    // Session-row tags, which sessions.list() can filter on server-side.
    ...(userId ? { tags: [ownerTag(userId)] } : {}),
    ...(trimmed
      ? { metadata: { title: trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed } }
      : {}),
  });
}

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

/**
 * Remove a conversation. Closes the underlying Session, which drops it out of
 * the sidebar's `sessions.list()`. Scoped to the caller's own id, read
 * server-side from the cookie.
 */
export async function deleteChat(chatId: string) {
  const userId = await getUserId();
  if (!userId) return;
  await closeChat(chatId, userId);
  revalidatePath("/", "layout");
}
