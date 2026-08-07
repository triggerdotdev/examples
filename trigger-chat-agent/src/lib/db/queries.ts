import { and, desc, eq } from "drizzle-orm";
import type { UIMessage } from "ai";
import { getDb } from "./index";
import { chat, chatSession } from "./schema";

/**
 * Every read and write is scoped by `userId`. Without that, anyone could
 * enumerate chat ids and read someone else's conversation — the example runs
 * on a public URL, so the ownership check is not optional.
 */

export async function listChats(userId: string) {
  const db = getDb();
  if (!db) return [];
  return db
    .select({ id: chat.id, title: chat.title, updatedAt: chat.updatedAt })
    .from(chat)
    .where(eq(chat.userId, userId))
    .orderBy(desc(chat.updatedAt))
    .limit(50);
}

export async function getChat(chatId: string, userId: string) {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function getChatSession(chatId: string, userId: string) {
  const db = getDb();
  if (!db) return null;
  // Join through `chat` so a session is only readable by its owner — the
  // token it holds is scoped to the chat.
  const [row] = await db
    .select({ publicAccessToken: chatSession.publicAccessToken, lastEventId: chatSession.lastEventId })
    .from(chatSession)
    .innerJoin(chat, eq(chat.id, chatSession.chatId))
    .where(and(eq(chatSession.chatId, chatId), eq(chat.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function deleteChat(chatId: string, userId: string) {
  const db = getDb();
  if (!db) return;
  await db.delete(chat).where(and(eq(chat.id, chatId), eq(chat.userId, userId)));
}

// ---------------------------------------------------------------------------
// Writes — called from the agent's lifecycle hooks (inside the Trigger task).
// ---------------------------------------------------------------------------

export async function ensureChat(chatId: string, userId: string) {
  const db = getDb();
  if (!db) return;
  await db.insert(chat).values({ id: chatId, userId }).onConflictDoNothing();
}

export async function saveMessages(chatId: string, messages: UIMessage[]) {
  const db = getDb();
  if (!db) return;
  await db
    .update(chat)
    .set({ messages, updatedAt: new Date() })
    .where(eq(chat.id, chatId));
}

/**
 * Persist the finished turn AND the transport's resume state together.
 *
 * These must be in one transaction: the next page load reads the messages and
 * the resume cursor in parallel. If a refresh lands between two separate
 * writes it can see the new assistant message but a stale `lastEventId`, then
 * resume from that old cursor and replay the turn on top of the message it
 * already has — a duplicated answer on screen.
 */
export async function saveTurn(args: {
  chatId: string;
  messages: UIMessage[];
  publicAccessToken: string;
  lastEventId?: string;
  title?: string;
}) {
  const db = getDb();
  if (!db) return;
  await db.transaction(async (tx) => {
    await tx
      .update(chat)
      .set({
        messages: args.messages,
        updatedAt: new Date(),
        ...(args.title ? { title: args.title } : {}),
      })
      .where(eq(chat.id, args.chatId));

    await tx
      .insert(chatSession)
      .values({
        chatId: args.chatId,
        publicAccessToken: args.publicAccessToken,
        lastEventId: args.lastEventId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: chatSession.chatId,
        set: {
          publicAccessToken: args.publicAccessToken,
          lastEventId: args.lastEventId,
          updatedAt: new Date(),
        },
      });
  });
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
