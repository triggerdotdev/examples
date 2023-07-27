"use server";

import { client } from "@/trigger";

export async function sendText(text: string) {
  return await client.sendEvent({
    name: "summarize.text",
    payload: {
      text,
    },
  });
}
