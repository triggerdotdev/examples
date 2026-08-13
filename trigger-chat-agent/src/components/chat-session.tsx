"use client";

import type { UIMessage } from "ai";
import { useEffect, useState } from "react";
import { Chat } from "@/components/chat";
import { loadMessages } from "@/lib/chat-store";

/**
 * Loads a chat's transcript from the device-local store (IndexedDB) before
 * mounting <Chat>, so `useChat` is seeded with the prior turns on a refresh.
 * There's no server DB — the transcript can only be read on the client — so this
 * is a legitimate external-store read on mount, gated until it resolves.
 * `key={chatId}` on <Chat> means switching chats remounts with fresh state.
 */
export function ChatSession({ chatId }: { chatId: string }) {
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);

  useEffect(() => {
    let active = true;
    loadMessages(chatId).then((messages) => {
      if (active) setInitialMessages(messages);
    });
    return () => {
      active = false;
    };
  }, [chatId]);

  // Brief: an IndexedDB read is sub-millisecond. Render nothing until it lands
  // so we never flash an empty thread over a conversation that exists.
  if (initialMessages === null) return null;

  return <Chat key={chatId} chatId={chatId} initialMessages={initialMessages} />;
}
