"use server"

import { auth, tasks, runs } from "@trigger.dev/sdk"
import type { ralphLoop } from "@/trigger/ralph-loop"
import { submitTaskSchema } from "@/lib/schemas"

type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E }

export async function getPublicToken(runId: string): Promise<Result<{ token: string }>> {
  try {
    const token = await auth.createPublicToken({
      scopes: {
        read: {
          runs: [runId],
        },
      },
    })
    return { ok: true, value: { token } }
  } catch (e) {
    console.error("Failed to create public token", e)
    return { ok: false, error: "Failed to create token" }
  }
}

export async function submitTask(
  formData: FormData
): Promise<Result<{ runId: string; token: string }>> {
  const raw = {
    repoUrl: formData.get("repoUrl"),
    prompt: formData.get("prompt"),
    pauseEvery: formData.get("pauseEvery") ?? "5",
  }

  const parsed = submitTaskSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Validation failed" }
  }

  try {
    const handle = await tasks.trigger<typeof ralphLoop>("ralph-loop", {
      repoUrl: parsed.data.repoUrl,
      prompt: parsed.data.prompt,
      pauseEvery: parsed.data.pauseEvery,
    })

    // Create public token for realtime access
    const token = await auth.createPublicToken({
      scopes: {
        read: { runs: [handle.id] },
        write: { runs: [handle.id] },
      },
    })

    return { ok: true, value: { runId: handle.id, token } }
  } catch (e) {
    console.error("Failed to trigger task", e)
    return { ok: false, error: "Failed to start task" }
  }
}

export async function cancelRun(runId: string): Promise<Result<{ id: string }>> {
  try {
    const result = await runs.cancel(runId)
    return { ok: true, value: { id: result.id } }
  } catch (e) {
    console.error("Failed to cancel run", e)
    return { ok: false, error: "Failed to cancel run" }
  }
}
