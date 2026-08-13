import type { ReactNode } from "react";
import { ChatSidebar } from "@/components/chat-sidebar";

// Shell for every conversation. The sidebar lives in the layout so it persists
// (and keeps its scroll) across chat-to-chat navigation instead of remounting.
// Hidden on small screens for now — a mobile drawer is a follow-up.
export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh w-full">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-grid-dimmed md:flex">
        <ChatSidebar />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
