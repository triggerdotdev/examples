"use client";

import { MessageSquare, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteChat } from "@/app/actions";
import { AgentWordmark } from "@/components/wordmark";
import { cn } from "@/lib/utils";

export type ChatListItem = { id: string; title: string; updatedAt: Date | string };

/** Today / Yesterday / Last 7 days / Older — a flat list reads as undated mush. */
function groupByDate(chats: ChatListItem[]) {
  const now = Date.now();
  const day = 86_400_000;
  const groups: { label: string; items: ChatListItem[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Last 7 days", items: [] },
    { label: "Older", items: [] },
  ];
  for (const c of chats) {
    const age = now - new Date(c.updatedAt).getTime();
    const bucket = age < day ? 0 : age < 2 * day ? 1 : age < 7 * day ? 2 : 3;
    groups[bucket].items.push(c);
  }
  return groups.filter((g) => g.items.length > 0);
}

export function Sidebar({ chats }: { chats: ChatListItem[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const groups = groupByDate(chats);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-grid-dimmed bg-charcoal-950 md:flex">
      <div className="flex items-center justify-between px-4 py-4">
        <AgentWordmark className="text-sm" />
      </div>

      <div className="px-3 pb-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg border border-charcoal-700 px-3 py-2 text-xs font-medium text-bright transition-colors hover:bg-charcoal-800"
        >
          <Plus className="size-3.5" /> New chat
        </Link>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-charcoal-800">
        {groups.length === 0 && (
          <p className="px-2 text-xs leading-relaxed text-dimmed/70">
            Your conversations will appear here.
          </p>
        )}
        {groups.map((group) => (
          <div key={group.label} className="space-y-1">
            <div className="px-2 font-mono text-2xs uppercase tracking-widest text-dimmed/60">{group.label}</div>
            {group.items.map((c) => {
              const active = pathname === `/chat/${c.id}`;
              return (
                <div
                  key={c.id}
                  className={cn(
                    "group flex items-center gap-1 rounded-lg pr-1 transition-colors",
                    active ? "bg-charcoal-800" : "hover:bg-charcoal-850"
                  )}
                >
                  <Link
                    href={`/chat/${c.id}`}
                    className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-xs text-bright/90"
                  >
                    <MessageSquare className="size-3 shrink-0 text-dimmed" />
                    <span className="truncate">{c.title}</span>
                  </Link>
                  <button
                    type="button"
                    aria-label={`Delete ${c.title}`}
                    onClick={() =>
                      startTransition(async () => {
                        await deleteChat(c.id);
                        if (active) router.push("/");
                      })
                    }
                    className="shrink-0 rounded p-1.5 text-dimmed opacity-0 transition-opacity hover:text-error group-hover:opacity-100"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
