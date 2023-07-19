"use server";

import { client } from "@/trigger";

export async function sendText(text: string) {
  await client.sendEvent({
    name: "summarize.text",
    payload: {
      text,
    },
  });
}
