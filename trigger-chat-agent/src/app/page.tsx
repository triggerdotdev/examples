import { randomUUID } from "node:crypto";
import { Chat } from "@/components/chat";
import { getUserId } from "@/lib/user";

// A new chat. The id is minted here and only becomes a real row when the agent
// creates it in onChatStart — the URL switches to /chat/<id> on the first
// message without a navigation, so the stream isn't interrupted.
export default async function Home() {
  const userId = (await getUserId()) ?? randomUUID();
  return <Chat chatId={randomUUID()} userId={userId} />;
}
