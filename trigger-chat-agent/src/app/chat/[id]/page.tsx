import { notFound } from "next/navigation";
import { Chat } from "@/components/chat";
import { ownsChat } from "@/lib/chats";
import { getUserId } from "@/lib/user";

/**
 * An existing conversation. The Session outlives its runs, so sending a message
 * here continues the same chat — the agent rebuilds the full history from
 * Trigger.dev's snapshot, so it remembers everything that was said.
 *
 * What this page can't do is repaint the earlier turns: `session.out` is trimmed
 * to about one turn, and there's no public API to read the stored transcript, so
 * the browser has no copy of what it never received. Hence `resumed` — the UI
 * says so rather than pretending the chat was empty. Persisting `uiMessages`
 * yourself (see the Database persistence pattern in the docs) is the documented
 * way to render past turns.
 */
export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) notFound();
  if (!(await ownsChat(id, userId))) notFound();

  return <Chat chatId={id} userId={userId} resumed />;
}
