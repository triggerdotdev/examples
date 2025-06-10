"use server";

import { tasks } from "@trigger.dev/sdk";
import type { deepResearch } from "@/trigger/deepResearch";

export async function deepResearchAction(formData: FormData) {
  const prompt = formData.get("prompt") as string;
  await tasks.trigger<typeof deepResearch>("deep-research", {
    prompt,
  });
}
