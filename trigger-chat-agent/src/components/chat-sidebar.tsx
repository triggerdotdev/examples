"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SquarePen, Trash2 } from "lucide-react";
import { useSyncExternalStore } from "react";
import {
  type ChatMeta,
  getChatsSnapshot,
  getServerChatsSnapshot,
  removeChat,
  subscribeChats,
} from "@/lib/chat-store";
import { cn } from "@/lib/utils";
import { discardChatRuntime } from "@/components/chat";

// A chat goes read-only 48h after its last turn. The store keeps expired chats
// in the index (nothing is deleted on the client), so the sidebar simply marks
// them — the conversation view enforces the read-only behaviour itself.
const EXPIRY_MS = 48 * 60 * 60 * 1000;

// The active chat id, parsed from a `/c/<id>` pathname. `null` anywhere else.
function activeChatIdFrom(pathname: string | null): string | null {
  if (!pathname) return null;
  const match = /^\/c\/([^/]+)/.exec(pathname);
  return match ? match[1] : null;
}

export function ChatSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const chats = useSyncExternalStore(
    subscribeChats,
    getChatsSnapshot,
    getServerChatsSnapshot,
  );
  const router = useRouter();
  const pathname = usePathname();

  const activeChatId = activeChatIdFrom(pathname);
  // The store hands the list back newest-created-first and never reorders it, so
  // the sidebar just renders it in order — a chat holds its place when you send
  // another message in it. `Date.now()` at render drives only the expiry badge.
  const now = Date.now();

  function startNewChat() {
    onNavigate?.();
    router.push(`/c/${crypto.randomUUID()}`);
  }

  async function handleDelete(chatId: string) {
    try {
      await discardChatRuntime(chatId);
      await removeChat(chatId);
    } catch (error) {
      console.error("Could not delete the local chat", error);
      return;
    }
    // Deleting the chat you're viewing would strand you on a dead route — send
    // yourself to a fresh one instead.
    if (chatId === activeChatId) {
      onNavigate?.();
      router.push(`/c/${crypto.randomUUID()}`);
    }
  }

  return (
    <div className="flex h-full flex-col bg-charcoal-950">
      <div className="shrink-0 p-3">
        <button
          type="button"
          onClick={startNewChat}
          className="group flex min-h-11 w-full items-center gap-2 rounded-xl border border-charcoal-650 bg-charcoal-900 px-3 text-sm font-medium text-bright transition-colors duration-150 hover:border-apple-500/60 hover:bg-charcoal-850"
        >
          <SquarePen className="size-4 shrink-0 text-apple-500" />
          New chat
        </button>
      </div>

      <nav
        aria-label="Past chats"
        className="min-h-0 flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-charcoal-700"
      >
        {chats.length === 0 ? (
          <p className="px-4 py-3 text-xs leading-5 text-charcoal-500">
            Your chats will appear here
          </p>
        ) : (
          <ul className="space-y-0.5 px-2 pb-4">
            {chats.map((chat) => (
              <ChatRow
                key={chat.chatId}
                chat={chat}
                active={chat.chatId === activeChatId}
                expired={now - chat.updatedAt > EXPIRY_MS}
                onDelete={handleDelete}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        )}
      </nav>
    </div>
  );
}

function ChatRow({
  chat,
  active,
  expired,
  onDelete,
  onNavigate,
}: {
  chat: ChatMeta;
  active: boolean;
  expired: boolean;
  onDelete: (chatId: string) => void;
  onNavigate?: () => void;
}) {
  const title = chat.title ?? "New chat";

  return (
    // The delete affordance is a sibling of the Link (not nested inside it —
    // interactive controls don't nest), overlaid on the right and revealed on
    // hover/focus. The Link reserves right padding so it never sits under it.
    <li className="group relative">
      <Link
        href={`/c/${chat.chatId}`}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        title={title}
        className={cn(
          "flex min-h-11 items-center gap-2 rounded-lg py-2 pl-3 pr-9 text-sm transition-colors duration-150",
          active
            ? "bg-charcoal-800 text-bright"
            : "text-dimmed hover:bg-charcoal-900 hover:text-bright",
          expired && !active && "text-charcoal-500",
        )}
      >
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {expired && (
          <span className="shrink-0 rounded-md bg-charcoal-800 px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wider text-charcoal-500">
            Expired
          </span>
        )}
      </Link>

      <button
        type="button"
        onClick={() => onDelete(chat.chatId)}
        aria-label={`Delete chat: ${title}`}
        className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-charcoal-500 opacity-0 transition-[color,opacity] duration-150 hover:bg-charcoal-700 hover:text-bright focus-visible:opacity-100 group-hover:opacity-100 motion-reduce:transition-none"
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}
