"use server";

import { realtimeImageGeneration } from "@/trigger/realtime-generate-image";
import { tasks } from "@trigger.dev/sdk/v3";
import { redirect } from "next/navigation";

export async function processImage(formData: FormData) {
  const prompt = formData.get("prompt") as string;
  const imageModel = formData.get("imageModel") as string;

  const handle = await tasks.trigger<typeof realtimeImageGeneration>(
    "realtime-image-generation",
    {
      prompt,
      imageModel,
    },
  );

  redirect(
    `/processing/${handle.id}?publicAccessToken=${handle.publicAccessToken}`,
  );
}
