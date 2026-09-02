import { ChatSession } from "@/components/chat-session";

// The chatId is the URL — the source of truth for which conversation this is.
// The transcript itself is device-local (IndexedDB), so there's nothing to load
// on the server; the client ChatSession rehydrates it. `params` is async in Next 16.
export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;
  return <ChatSession chatId={chatId} />;
}
