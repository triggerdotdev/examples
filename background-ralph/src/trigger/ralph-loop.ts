import { task, logger } from "@trigger.dev/sdk"
import { query } from "@anthropic-ai/claude-agent-sdk"
import { exec } from "child_process"
import { promisify } from "util"
import { mkdtemp, rm } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"
import { statusStream, agentOutputStream } from "./streams"

const execAsync = promisify(exec)

export type RalphLoopPayload = {
  repoUrl: string
  prompt: string
  githubToken?: string
  maxIterations?: number // Default: 10
}

const DEFAULT_MAX_ITERATIONS = 10

async function cloneRepo(
  repoUrl: string,
  githubToken?: string
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const tempDir = await mkdtemp(join(tmpdir(), "ralph-"))

  // Inject token into URL if provided (for private repos)
  let cloneUrl = repoUrl
  if (githubToken && repoUrl.startsWith("https://github.com/")) {
    cloneUrl = repoUrl.replace(
      "https://github.com/",
      `https://${githubToken}@github.com/`
    )
  }

  await execAsync(`git clone --depth 1 ${cloneUrl} ${tempDir}`)

  return {
    path: tempDir,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true })
    },
  }
}

export const ralphLoop = task({
  id: "ralph-loop",
  maxDuration: 3600,
  machine: "small-2x",
  run: async (payload: RalphLoopPayload, { signal }) => {
    const { repoUrl, prompt, githubToken, maxIterations = DEFAULT_MAX_ITERATIONS } = payload

    // Wire up abort signal for cancellation
    const abortController = new AbortController()
    signal.addEventListener("abort", () => abortController.abort())

    // Stream: cloning status
    await statusStream.append({ type: "cloning", message: `Cloning ${repoUrl}...` })

    let repoPath: string
    let cleanup: () => Promise<void>

    try {
      const result = await cloneRepo(repoUrl, githubToken)
      repoPath = result.path
      cleanup = result.cleanup
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown clone error"
      await statusStream.append({ type: "error", message: `Clone failed: ${message}` })
      throw new Error(`Failed to clone repository: ${message}`)
    }

    await statusStream.append({ type: "cloned", message: `Cloned to ${repoPath}` })

    try {
      // Run Claude Agent SDK loop
      await statusStream.append({ type: "working", message: "Starting agent loop..." })

      let iterationCount = 0

      const agentResult = query({
        prompt,
        options: {
          model: "claude-sonnet-4-20250514",
          abortController,
          cwd: repoPath,
          maxTurns: maxIterations,
          permissionMode: "acceptEdits",
          includePartialMessages: true, // Enable incremental text streaming
          allowedTools: ["Read", "Edit", "Write", "Bash", "Grep", "Glob"],
        },
      })

      // Use writer pattern for streaming agent output
      const { waitUntilComplete } = agentOutputStream.writer({
        execute: async ({ write }) => {
          for await (const message of agentResult) {
            logger.info("Agent message", { type: message.type })

            // Track iterations (each assistant turn is an iteration)
            if (message.type === "assistant") {
              iterationCount++
              await statusStream.append({
                type: "iteration",
                message: `Iteration ${iterationCount}/${maxIterations}`,
                iteration: iterationCount,
              })
            }

            // Stream text deltas for realtime output
            if (
              message.type === "stream_event" &&
              message.event.type === "content_block_delta" &&
              message.event.delta.type === "text_delta"
            ) {
              write(message.event.delta.text)
            }
          }
        },
      })

      await waitUntilComplete()

      // Show what changed before cleanup
      try {
        const { stdout: diff } = await execAsync(`git -C ${repoPath} diff`)
        const { stdout: status } = await execAsync(`git -C ${repoPath} status --short`)
        if (diff || status) {
          await statusStream.append({
            type: "diff",
            message: `Changes:\n${status}`,
            diff: diff || "(no diff, possibly new files)",
          })
        }
      } catch {
        // Git diff failed, not critical
      }

      // TODO US-005: Commit and push

      await statusStream.append({ type: "complete", message: `Task complete after ${iterationCount} iterations` })

      return { success: true, iterations: iterationCount }
    } finally {
      // Always cleanup temp directory
      await cleanup()
    }
  },
})
