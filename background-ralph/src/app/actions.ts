"use server"

import { tasks } from "@trigger.dev/sdk"
import type { ralphLoop } from "@/trigger/ralph-loop"
import { submitTaskSchema } from "@/lib/schemas"

type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E }

export async function submitTask(
  formData: FormData
): Promise<Result<{ runId: string }>> {
  const raw = {
    repoUrl: formData.get("repoUrl"),
    prompt: formData.get("prompt"),
  }

  const parsed = submitTaskSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Validation failed" }
  }

  try {
    const handle = await tasks.trigger<typeof ralphLoop>("ralph-loop", {
      repoUrl: parsed.data.repoUrl,
      prompt: parsed.data.prompt,
    })

    return { ok: true, value: { runId: handle.id } }
  } catch (e) {
    console.error("Failed to trigger task", e)
    return { ok: false, error: "Failed to start task" }
  }
}
