"use server";

import { claudeStream } from "@/src/trigger/claude-stream";
import { tasks } from "@trigger.dev/sdk/v3";

export async function streamWithClaude(prompt: string) {
  // Trigger the claude-stream task
  const run = await tasks.trigger<typeof claudeStream>("claude-stream", {
    prompt: prompt,
  });

  return { run };
}
