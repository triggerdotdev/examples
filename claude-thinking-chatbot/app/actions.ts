"use server";

import { claudeStream } from "@/src/trigger/claude-stream";
import { auth, runs, tasks } from "@trigger.dev/sdk/v3";

export async function streamWithClaude(
  prompt: string,
) {
  const run = await tasks.trigger<typeof claudeStream>("claude-stream", {
    prompt: prompt,
  });

  const publicAccessToken = await auth.createPublicToken({
    scopes: {
      read: {
        tasks: ["claude-stream"], // 👈 this token can read all runs of these tasks
      },
    },
  });

  return { run, publicAccessToken };
}
