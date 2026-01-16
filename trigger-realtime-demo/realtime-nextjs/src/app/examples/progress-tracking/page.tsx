import { SplitViewer } from "@/components/split-viewer"
import { CodePanel, CodeFile } from "@/components/code-panel"
import { AppPanel } from "@/components/app-panel"
import { ProgressDemo } from "./progress-demo"
import { highlightCode } from "@/lib/shiki"

// Example code files to display (raw code, will be highlighted server-side)
const rawCodeFiles = [
  {
    name: "task.ts",
    language: "typescript",
    code: `import { task } from "@trigger.dev/sdk/v3"
import { progressStream } from "./streams"

export const processDataTask = task({
  id: "process-data",
  maxDuration: 300,
  run: async (payload: { items: number }) => {
    const total = payload.items

    for (let i = 0; i < total; i++) {
      // Simulate work
      await new Promise((r) => setTimeout(r, 500))

      // Stream progress update
      await progressStream.write({
        current: i + 1,
        total,
        message: \`Processing item \${i + 1} of \${total}\`,
      })
    }

    return { processed: total }
  },
})`,
  },
  {
    name: "streams.ts",
    language: "typescript",
    code: `import { streams } from "@trigger.dev/sdk/v3"

type ProgressUpdate = {
  current: number
  total: number
  message: string
}

export const progressStream = streams.define<ProgressUpdate>({
  id: "progress",
})`,
  },
  {
    name: "actions.ts",
    language: "typescript",
    code: `"use server"

import { tasks, auth } from "@trigger.dev/sdk/v3"
import type { processDataTask } from "@/trigger/tasks"

export async function startProcessing(itemCount: number) {
  const handle = await tasks.trigger<typeof processDataTask>(
    "process-data",
    { items: itemCount }
  )

  const token = await auth.createPublicToken({
    scopes: { read: { runs: [handle.id] } },
  })

  return { runId: handle.id, token }
}`,
  },
]

export default async function ProgressTrackingPage() {
  // Pre-render syntax highlighting on the server
  const codeFiles: CodeFile[] = await Promise.all(
    rawCodeFiles.map(async (file) => ({
      ...file,
      html: await highlightCode(file.code, file.language),
    }))
  )

  return (
    <SplitViewer
      appPanel={
        <AppPanel
          title="Progress Tracking"
          description="Watch task progress stream to the UI in real-time"
        >
          <ProgressDemo />
        </AppPanel>
      }
      codePanel={<CodePanel files={codeFiles} />}
    />
  )
}
