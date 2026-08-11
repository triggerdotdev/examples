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
 * A chat is owned by an `owner:<id>` tag on its Session, and named by a `title`
 * in session metadata — both set when the session is created (see
 * `startChatSession` in `src/app/actions.ts`), since `sessions.update()` needs a
 * secret key the browser doesn't have.
 *
 * Note the tag goes in the top-level `tags` field, not `triggerConfig.tags`:
 * the latter tags every *run* the session schedules, and `sessions.list({ tag })`
 * filters on the session's own tags.
 */
export const ownerTag = (userId: string) => `owner:${userId}`;

export type ChatSummary = {
  chatId: string;
  title: string;
  updatedAt: Date;
};

const MAX_CHATS = 50;

/** The visitor's conversations, newest first. Filtered by tag server-side. */
export async function listChats(userId: string): Promise<ChatSummary[]> {
  const out: ChatSummary[] = [];

  try {
    for await (const session of sessions.list({
      type: "chat.agent",
      tag: ownerTag(userId),
      status: "ACTIVE",
      limit: 50,
    })) {
      // A session with no externalId can't be routed to, so it isn't openable.
      if (!session.externalId) continue;

      const metadata = (session.metadata ?? {}) as { title?: unknown };
      out.push({
        chatId: session.externalId,
        title: typeof metadata.title === "string" && metadata.title ? metadata.title : "New chat",
        updatedAt: new Date(session.updatedAt ?? session.createdAt),
      });

      if (out.length >= MAX_CHATS) break;
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
    return Boolean(session?.tags?.includes(ownerTag(userId)));
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
