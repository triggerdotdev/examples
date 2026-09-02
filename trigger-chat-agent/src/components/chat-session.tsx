"use client";

import type { UIMessage } from "ai";
import type { ChatSessionPersistedState } from "@trigger.dev/sdk/chat";
import { useEffect, useState } from "react";
import { Chat } from "@/components/chat";
import { loadMessages, loadSession } from "@/lib/chat-store";

type HydratedChat = {
  chatId: string;
  messages: UIMessage[];
  session: ChatSessionPersistedState | null;
};

/**
 * Loads a chat's transcript from the device-local store (IndexedDB) before
 * mounting <Chat>, so `useChat` is seeded with the prior turns on a refresh.
 * There's no server DB — the transcript can only be read on the client — so this
 * is a legitimate external-store read on mount, gated until it resolves.
 * `key={chatId}` on <Chat> means switching chats remounts with fresh state.
 */
export function ChatSession({ chatId }: { chatId: string }) {
  const [hydrated, setHydrated] = useState<HydratedChat | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([loadMessages(chatId), loadSession(chatId)]).then(
      ([messages, session]) => {
        if (active) setHydrated({ chatId, messages, session });
      },
      (error) => {
        console.error("Could not load the local chat transcript", error);
        if (active) setHydrated({ chatId, messages: [], session: null });
      },
    );
    return () => {
      active = false;
    };
  }, [chatId]);

  // The state may still contain the previous route's transcript for one render.
  // Never mount it under the new chat id while that chat is being hydrated.
  if (hydrated?.chatId !== chatId) return null;

  return (
    <Chat
      key={chatId}
      chatId={chatId}
      initialMessages={hydrated.messages}
      initialSession={hydrated.session}
    />
  );
}
