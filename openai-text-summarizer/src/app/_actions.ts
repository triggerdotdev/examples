"use server";

import { client } from "@/trigger";
import { redirect } from "next/navigation";

export async function sendText(data: FormData) {
  const text = data.get("text");

  const event = await client.sendEvent({
    name: "summarize.text",
    payload: {
      text,
    },
  });

  redirect(`/summarize/${event.id}`);
}
