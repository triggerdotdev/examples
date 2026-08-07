import { desc, sql } from "drizzle-orm";
import { index, json, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { UIMessage } from "ai";

/**
 * Two tables, mirroring the split in Trigger.dev's chat persistence pattern:
 *
 * - `chat`     — the durable transcript. What the sidebar lists.
 * - `chatSession` — what the transport needs to reconnect after a refresh:
 *                a session-scoped access token and the SSE resume cursor.
 *
 * Messages are stored as one JSON column of `UIMessage[]`, not normalized into
 * a messages table. Tool-call part shapes change with every AI SDK release, so
 * a JSON column means an SDK upgrade never needs a migration.
 */

export const chat = pgTable(
  "chat",
  {
    id: text("id").primaryKey(), // the chatId the transport uses
    userId: uuid("user_id").notNull(), // anonymous cookie id — no login in this example
    title: text("title").notNull().default("New chat"),
    messages: json("messages").$type<UIMessage[]>().notNull().default(sql`'[]'::json`),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  // Exactly the sidebar's query: this user's chats, newest first.
  (t) => [index("chat_user_id_updated_at_idx").on(t.userId, desc(t.updatedAt))]
);

export const chatSession = pgTable("chat_session", {
  chatId: text("chat_id")
    .primaryKey()
    .references(() => chat.id, { onDelete: "cascade" }),
  publicAccessToken: text("public_access_token").notNull(),
  lastEventId: text("last_event_id"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Chat = typeof chat.$inferSelect;
