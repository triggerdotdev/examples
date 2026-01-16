"use server"

import { tasks, auth } from "@trigger.dev/sdk/v3"
import type { processDataTask } from "@/trigger/tasks"

export async function startProcessing(itemCount: number) {
  const handle = await tasks.trigger<typeof processDataTask>(
    "process-data",
    { items: itemCount }
  )

  // Token scoped to only read this specific run
  const token = await auth.createPublicToken({
    scopes: { read: { runs: [handle.id] } },
  })

  return { runId: handle.id, token }
}
