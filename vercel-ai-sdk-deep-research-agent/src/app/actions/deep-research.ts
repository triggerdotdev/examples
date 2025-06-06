"use server";

import { tasks } from "@trigger.dev/sdk/v3";
import type { deepResearch } from "@/trigger/deepResearch";

export async function deepResearchAction(prompt: string) {
  const report = await tasks.trigger<typeof deepResearch>(
    "deep-research",
    {
      prompt,
    },
  );

  return report;
}
