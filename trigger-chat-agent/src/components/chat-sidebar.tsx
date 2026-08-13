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

// A chat goes read-only 48h after its last turn. The store keeps expired chats
// in the index (nothing is deleted on the client), so the sidebar simply marks
// them — the conversation view enforces the read-only behaviour itself.
const EXPIRY_MS = 48 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

// Newest-first order the group headers are rendered in. Empty buckets are
// skipped at render time, so this is just the canonical sequence.
const BUCKET_ORDER = [
  "Today",
  "Yesterday",
  "Previous 7 Days",
  "Previous 30 Days",
  "Older",
] as const;

type BucketLabel = (typeof BUCKET_ORDER)[number];
type ChatGroup = { label: BucketLabel; chats: ChatMeta[] };

// Calendar-relative bucketing: "Today"/"Yesterday" use local midnight
// boundaries (not rolling 24h windows) so a chat from this morning always reads
// as Today, and the wider buckets fall back to rolling windows off midnight.
function bucketFor(updatedAt: number, startOfToday: number): BucketLabel {
  if (updatedAt >= startOfToday) return "Today";
  if (updatedAt >= startOfToday - DAY_MS) return "Yesterday";
  if (updatedAt >= startOfToday - 7 * DAY_MS) return "Previous 7 Days";
  if (updatedAt >= startOfToday - 30 * DAY_MS) return "Previous 30 Days";
  return "Older";
}

function startOfDay(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

// Sort newest-first (defensively — the store already sorts) and split into the
// non-empty date buckets in canonical order.
function groupChats(chats: ChatMeta[], now: number): ChatGroup[] {
  const startOfToday = startOfDay(now);
  const sorted = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);

  const byLabel = new Map<BucketLabel, ChatMeta[]>();
  for (const chat of sorted) {
    const label = bucketFor(chat.updatedAt, startOfToday);
    const existing = byLabel.get(label);
    if (existing) existing.push(chat);
    else byLabel.set(label, [chat]);
  }

  return BUCKET_ORDER.flatMap((label) => {
    const bucket = byLabel.get(label);
    return bucket && bucket.length > 0 ? [{ label, chats: bucket }] : [];
  });
}

// The active chat id, parsed from a `/c/<id>` pathname. `null` anywhere else.
function activeChatIdFrom(pathname: string | null): string | null {
  if (!pathname) return null;
  const match = /^\/c\/([^/]+)/.exec(pathname);
  return match ? match[1] : null;
}

export function ChatSidebar() {
  const chats = useSyncExternalStore(
    subscribeChats,
    getChatsSnapshot,
    getServerChatsSnapshot,
  );
  const router = useRouter();
  const pathname = usePathname();

  const activeChatId = activeChatIdFrom(pathname);
  // `Date.now()` at render is fine here: the store notifies on every change and
  // navigation re-renders, so the buckets/expiry stay in step with the list.
  const groups = groupChats(chats, Date.now());

  function startNewChat() {
    router.push(`/c/${crypto.randomUUID()}`);
  }

  async function handleDelete(chatId: string) {
    await removeChat(chatId);
    // Deleting the chat you're viewing would strand you on a dead route — send
    // yourself to a fresh one instead.
    if (chatId === activeChatId) {
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
        {groups.length === 0 ? (
          <p className="px-4 py-3 text-xs leading-5 text-charcoal-500">
            Your chats will appear here
          </p>
        ) : (
          <div className="space-y-4 px-2 pb-4">
            {groups.map((group) => (
              <section key={group.label}>
                <h2 className="px-2 pb-1.5 pt-1 font-mono text-2xs uppercase tracking-widest text-charcoal-500">
                  {group.label}
                </h2>
                <ul className="space-y-0.5">
                  {group.chats.map((chat) => (
                    <ChatRow
                      key={chat.chatId}
                      chat={chat}
                      active={chat.chatId === activeChatId}
                      expired={Date.now() - chat.updatedAt > EXPIRY_MS}
                      onDelete={handleDelete}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
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
}: {
  chat: ChatMeta;
  active: boolean;
  expired: boolean;
  onDelete: (chatId: string) => void;
}) {
  const title = chat.title ?? "New chat";

  return (
    // The delete affordance is a sibling of the Link (not nested inside it —
    // interactive controls don't nest), overlaid on the right and revealed on
    // hover/focus. The Link reserves right padding so it never sits under it.
    <li className="group relative">
      <Link
        href={`/c/${chat.chatId}`}
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
