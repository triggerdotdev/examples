import type { ReactNode } from "react";
import { ChatSidebar } from "@/components/chat-sidebar";
import { MobileChatNav } from "@/components/mobile-chat-nav";

// Shell for every conversation. The sidebar lives in the layout so it persists
// (and keeps its scroll) across chat-to-chat navigation instead of remounting.
export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh w-full">
      <MobileChatNav />
      <aside
        data-chat-sidebar
        className="hidden w-72 shrink-0 flex-col border-r border-grid-dimmed md:flex"
      >
        <ChatSidebar />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
