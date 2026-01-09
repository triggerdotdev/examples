import { task } from "@trigger.dev/sdk"
import { exec } from "child_process"
import { promisify } from "util"
import { mkdtemp, rm } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"
import { statusStream } from "./streams"

const execAsync = promisify(exec)

export type RalphLoopPayload = {
  repoUrl: string
  prompt: string
  githubToken?: string
}

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
  run: async (payload: RalphLoopPayload) => {
    const { repoUrl, prompt, githubToken } = payload

    // Create status writer
    const { waitUntilComplete: waitForStatusStream } = statusStream.writer({
      execute: async ({ write }) => {
        // Stream: cloning status
        write({ type: "cloning", message: `Cloning ${repoUrl}...` })

        let repoPath: string
        let cleanup: () => Promise<void>

        try {
          const result = await cloneRepo(repoUrl, githubToken)
          repoPath = result.path
          cleanup = result.cleanup
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown clone error"
          write({ type: "error", message: `Clone failed: ${message}` })
          throw new Error(`Failed to clone repository: ${message}`)
        }

        write({
          type: "cloned",
          message: `Cloned to ${repoPath}`,
        })

        try {
          // TODO US-004: Claude Agent SDK loop
          // TODO US-005: Commit and push
          // TODO US-006: More realtime streaming

          write({ type: "complete", message: "Task complete" })
        } finally {
          // Always cleanup temp directory
          await cleanup()
        }
      },
    })

    await waitForStatusStream()

    return { success: true }
  },
})
