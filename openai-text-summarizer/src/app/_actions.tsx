"use server";

import { client } from "@/trigger";

export async function sendText(text: string) {
  await client.sendEvent({
    name: "send.text",
    payload: {
      text,
    },
  });
}
