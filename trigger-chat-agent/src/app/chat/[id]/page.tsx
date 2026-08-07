import { notFound } from "next/navigation";
import { Chat } from "@/components/chat";
import { getChat, getChatSession } from "@/lib/db/queries";
import { getUserId } from "@/lib/user";

// An existing conversation, loaded server-side so the transcript is in the
// first paint. `getChat` is scoped by user id, so an unknown or someone else's
// chat is a 404.
export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) notFound();

  const [row, session] = await Promise.all([getChat(id, userId), getChatSession(id, userId)]);
  if (!row) notFound();

  return (
    <Chat
      chatId={row.id}
      userId={userId}
      initialMessages={row.messages}
      initialSessions={
        session
          ? {
              [row.id]: {
                publicAccessToken: session.publicAccessToken,
                lastEventId: session.lastEventId ?? undefined,
              },
            }
          : undefined
      }
    />
  );
}
