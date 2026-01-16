// =============================================================================
// PROGRESS TRACKING EXAMPLE PAGE
// =============================================================================
// This is a Server Component that renders the split-screen viewer.
//
// Architecture:
// - Left side (AppPanel): Interactive demo UI with Start button and progress
// - Right side (CodePanel): Syntax-highlighted code with tabs
//
// The code is highlighted server-side using Shiki for performance.
// The rawCodeFiles contain the DISPLAY code - simplified examples that
// users see in the CodePanel. This is separate from the actual source files.
// =============================================================================

import { SplitViewer } from "@/components/split-viewer"
import { CodePanel, CodeFile } from "@/components/code-panel"
import { AppPanel } from "@/components/app-panel"
import { ProgressDemo } from "./progress-demo"
import { highlightCode } from "@/lib/shiki"

// =============================================================================
// DISPLAY CODE
// =============================================================================
// These are the code snippets shown in the CodePanel.
// They're simplified versions of the actual code for demonstration purposes.
// Each object becomes a tab in the code viewer.
//
// IMPORTANT: The line numbers in code-mappings.ts refer to these snippets,
// not the actual source files. If you modify this code, update the mappings!
// =============================================================================

const rawCodeFiles = [
  // ---------------------------------------------------------------------------
  // TASK FILE
  // ---------------------------------------------------------------------------
  // Shows how to define a Trigger.dev task that streams progress updates.
  {
    name: "task.ts",
    language: "typescript",
    code: `// Import the task function from Trigger.dev SDK
import { task } from "@trigger.dev/sdk/v3"
// Import our typed stream definition
import { progressStream } from "./streams"

// Define a task that processes items and streams progress
export const processDataTask = task({
  // Unique ID - used when triggering from your app
  id: "process-data",
  // Max time before timeout (5 minutes)
  maxDuration: 300,

  // The run function contains your task logic
  run: async (payload: { items: number }) => {
    const total = payload.items

    // Process each item
    for (let i = 0; i < total; i++) {
      // Simulate work (API call, computation, etc.)
      await new Promise((r) => setTimeout(r, 500))

      // Stream progress to the frontend
      // The frontend receives this instantly via useRealtimeStream()
      await progressStream.append({
        current: i + 1,
        total,
        message: \`Processing item \${i + 1} of \${total}\`,
      })
    }

    // Return result (available in run output)
    return { processed: total }
  },
})`,
  },

  // ---------------------------------------------------------------------------
  // STREAMS FILE
  // ---------------------------------------------------------------------------
  // Shows how to define a typed stream for real-time updates.
  {
    name: "streams.ts",
    language: "typescript",
    code: `// Import streams from Trigger.dev SDK
import { streams } from "@trigger.dev/sdk/v3"

// Define the shape of progress updates
// This type is shared between task and frontend
type ProgressUpdate = {
  current: number  // Current item (1-indexed)
  total: number    // Total items to process
  message: string  // Human-readable status
}

// Create a typed stream
// - "progress" is the stream ID (used to subscribe)
// - ProgressUpdate is the type of each chunk
export const progressStream = streams.define<ProgressUpdate>({
  id: "progress",
})`,
  },

  // ---------------------------------------------------------------------------
  // SERVER ACTION FILE
  // ---------------------------------------------------------------------------
  // Shows how to trigger tasks and create tokens for real-time access.
  {
    name: "actions.ts",
    language: "typescript",
    code: `"use server"
// ^ This directive marks all exports as Server Actions
// Server Actions run on the server but can be called from client code

import { tasks, auth } from "@trigger.dev/sdk/v3"
// Type-only import to avoid bundling task code in frontend
import type { processDataTask } from "@/trigger/tasks"

// Server Action to start processing
export async function startProcessing(itemCount: number) {
  // 1. Trigger the task
  // tasks.trigger() starts a new run and returns a handle
  const handle = await tasks.trigger<typeof processDataTask>(
    "process-data",     // Task ID
    { items: itemCount } // Payload (typed!)
  )

  // 2. Create a public token for frontend access
  // This token can ONLY read this specific run
  const token = await auth.createPublicToken({
    scopes: { read: { runs: [handle.id] } },
  })

  // 3. Return credentials to frontend
  // Frontend uses these to subscribe to real-time updates
  return { runId: handle.id, token }
}`,
  },
]

// =============================================================================
// PAGE COMPONENT
// =============================================================================

/**
 * ProgressTrackingPage is an async Server Component.
 *
 * It pre-renders the syntax highlighting on the server using Shiki.
 * This is better for performance than client-side highlighting because:
 * 1. No JS needs to run on the client for highlighting
 * 2. The highlighted HTML is cached and served as static content
 * 3. No layout shift as the highlighting loads
 */
export default async function ProgressTrackingPage() {
  // ---------------------------------------------------------------------------
  // SERVER-SIDE SYNTAX HIGHLIGHTING
  // ---------------------------------------------------------------------------
  // We use Shiki to highlight the code on the server.
  // This produces HTML with inline styles for each syntax token.
  // The result is passed to CodePanel which renders it line-by-line.
  // ---------------------------------------------------------------------------
  const codeFiles: CodeFile[] = await Promise.all(
    rawCodeFiles.map(async (file) => ({
      ...file,
      // Add the highlighted HTML to each file object
      html: await highlightCode(file.code, file.language),
    }))
  )

  // ---------------------------------------------------------------------------
  // RENDER SPLIT VIEW
  // ---------------------------------------------------------------------------
  // SplitViewer provides the 50/50 layout and shared highlight state.
  // AppPanel wraps the interactive demo on the left.
  // CodePanel shows the syntax-highlighted code on the right.
  // ---------------------------------------------------------------------------
  return (
    <SplitViewer
      appPanel={
        <AppPanel
          title="Progress Tracking"
          description="Watch task progress stream to the UI in real-time"
        >
          {/* ProgressDemo contains the interactive UI */}
          <ProgressDemo />
        </AppPanel>
      }
      codePanel={
        // CodePanel renders the tabbed code viewer
        <CodePanel files={codeFiles} />
      }
    />
  )
}
