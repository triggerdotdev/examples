import { sessions } from "@trigger.dev/sdk";
import type { UIMessage } from "ai";

/**
 * Chat history without a database.
 *
 * Every `chat.agent` conversation is backed by a durable Session that outlives
 * its runs — Trigger.dev already stores the transcript in a snapshot and
 * rebuilds it when a chat continues on a fresh run. So there's nothing for us
 * to persist: the sidebar is just `sessions.list()`, filtered by a tag.
 *
 * The agent tags each session with its owner and writes the title into session
 * metadata (see the lifecycle hooks in `src/trigger/trigger-chat-agent.ts`).
 */

/**
 * The owner and title live in the Session's `metadata`, set when the session is
 * created (see `startChatSession` in `src/app/actions.ts`).
 *
 * Tags would be the natural fit — `sessions.list` can filter on them server-side
 * — but on SDK 4.5.9 `triggerConfig.tags` is dropped at create time and
 * `sessions.update()` returns Unauthorized even with a secret key. So the owner
 * goes in metadata and we filter after listing. Metadata isn't a server-side
 * filter, so this reads a page of sessions and narrows in memory: fine at demo
 * scale, and it never leaves the server, so the browser only ever receives this
 * visitor's own chats.
 */
export type ChatMetadata = { userId?: unknown; title?: unknown };

export type ChatSummary = {
  chatId: string;
  title: string;
  updatedAt: Date;
};

// Bounds the scan, since we can't filter by owner in the query itself.
const MAX_SESSIONS_SCANNED = 200;

/** The visitor's conversations, newest first. */
export async function listChats(userId: string): Promise<ChatSummary[]> {
  const out: ChatSummary[] = [];

  try {
    let scanned = 0;
    for await (const session of sessions.list({ type: "chat.agent", limit: 50 })) {
      if (++scanned > MAX_SESSIONS_SCANNED) break;
      // A session with no externalId can't be routed to, so it isn't listable.
      if (!session.externalId) continue;

      const metadata = (session.metadata ?? {}) as ChatMetadata;
      if (metadata.userId !== userId) continue;

      out.push({
        chatId: session.externalId,
        title: typeof metadata.title === "string" && metadata.title ? metadata.title : "New chat",
        updatedAt: new Date(session.updatedAt ?? session.createdAt),
      });
    }
  } catch (error) {
    // History is a nice-to-have: a listing failure shouldn't take down the
    // page, which works fine without a sidebar.
    console.error("Failed to list chat sessions", error);
    return [];
  }

  return out.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

/** True when this chat belongs to this visitor — checked before opening it. */
export async function ownsChat(chatId: string, userId: string): Promise<boolean> {
  try {
    const session = await sessions.retrieve(chatId);
    return ((session?.metadata ?? {}) as ChatMetadata).userId === userId;
  } catch {
    return false;
  }
}

/** Remove a conversation from the sidebar by closing its session. */
export async function closeChat(chatId: string, userId: string) {
  if (!(await ownsChat(chatId, userId))) return;
  await sessions.close(chatId);
}

/** First user message becomes the title, so the sidebar reads usefully. */
export function titleFromMessages(messages: UIMessage[]): string | undefined {
  const first = messages.find((m) => m.role === "user");
  if (!first) return undefined;
  const text = first.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ")
    .trim();
  if (!text) return undefined;
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}
