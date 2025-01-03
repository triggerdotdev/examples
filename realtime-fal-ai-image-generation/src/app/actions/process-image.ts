"use server";

import { realtimeImageGeneration } from "@/trigger/realtime-generate-image";
import { tasks } from "@trigger.dev/sdk/v3";
import { redirect } from "next/navigation";

export async function processImage(formData: FormData) {
  const imageUrl = formData.get("imageUrl") as string;
  const prompt = formData.get("prompt") as string;

  const handle = await tasks.trigger<typeof realtimeImageGeneration>(
    "realtime-image-generation",
    {
      imageUrl,
      prompt,
    }
  );

  redirect(
    `/processing/${handle.id}?publicAccessToken=${handle.publicAccessToken}`
  );
}
