"use server";

import { tasks } from "@trigger.dev/sdk";
import type { helloWorldTask } from "@/src/trigger/example";

export async function triggerHelloWorld(message: string) {
  try {
    const handle = await tasks.trigger<typeof helloWorldTask>(
      "hello-world",
      message,
    );

    return {
      success: true as const,
      runId: handle.id,
    };
  } catch (error) {
    console.error("Error triggering hello-world task:", error);
    return {
      success: false as const,
      error: "Failed to trigger task",
    };
  }
}
