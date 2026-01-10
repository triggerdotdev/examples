import { task, logger } from "@trigger.dev/sdk"
import { query } from "@anthropic-ai/claude-agent-sdk"
import Anthropic from "@anthropic-ai/sdk"
import { exec } from "child_process"
import { promisify } from "util"
import { mkdtemp, rm } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"
import { statusStream, agentOutputStream } from "./streams"

const execAsync = promisify(exec)
const anthropic = new Anthropic()

export type RalphLoopPayload = {
  repoUrl: string
  prompt: string
  maxIterations?: number // Default: 10
}

const DEFAULT_MAX_ITERATIONS = 10

async function cloneRepo(
  repoUrl: string
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const tempDir = await mkdtemp(join(tmpdir(), "ralph-"))
  const githubToken = process.env.GITHUB_TOKEN

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

function parseGitHubUrl(repoUrl: string): { owner: string; repo: string } | null {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/)
  if (!match) return null
  return { owner: match[1], repo: match[2] }
}

async function summarizeChanges(diff: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 100,
    messages: [
      {
        role: "user",
        content: `Summarize these git changes in one line (max 72 chars) for a commit message. Be specific about what changed, not generic. No quotes around the message.\n\n${diff.slice(0, 4000)}`,
      },
    ],
  })
  const text = response.content[0]
  if (text.type !== "text") return "Agent changes"
  return text.text.slice(0, 72)
}

async function commitAndPush(
  repoPath: string,
  repoUrl: string,
  githubToken: string
): Promise<string | null> {
  const parsed = parseGitHubUrl(repoUrl)
  logger.info("parseGitHubUrl result", { parsed, repoUrl })
  if (!parsed) return null

  const branchName = `ralph-${Date.now()}`
  logger.info("Creating branch", { branchName })

  // Configure git user for commits
  await execAsync(`git -C ${repoPath} config user.email "ralph@trigger.dev"`)
  await execAsync(`git -C ${repoPath} config user.name "Ralph (Trigger.dev)"`)

  // Create and checkout new branch
  await execAsync(`git -C ${repoPath} checkout -b ${branchName}`)

  // Stage all changes
  await execAsync(`git -C ${repoPath} add -A`)

  // Check if there are changes to commit
  const { stdout: status } = await execAsync(`git -C ${repoPath} status --porcelain`)
  logger.info("Git status", { status: status.trim() || "(empty)" })
  if (!status.trim()) return null

  // Get diff for summarization
  const { stdout: diff } = await execAsync(`git -C ${repoPath} diff --cached`)
  const commitMessage = await summarizeChanges(diff || status)

  // Commit
  await execAsync(`git -C ${repoPath} commit -m "${commitMessage.replace(/"/g, '\\"')}"`)

  // Set up authenticated remote and push
  const authUrl = `https://${githubToken}@github.com/${parsed.owner}/${parsed.repo}.git`
  await execAsync(`git -C ${repoPath} remote set-url origin ${authUrl}`)
  await execAsync(`git -C ${repoPath} push -u origin ${branchName}`)

  return `https://github.com/${parsed.owner}/${parsed.repo}/tree/${branchName}`
}

export const ralphLoop = task({
  id: "ralph-loop",
  maxDuration: 3600,
  machine: "small-2x",
  run: async (payload: RalphLoopPayload, { signal }) => {
    const { repoUrl, prompt, maxIterations = DEFAULT_MAX_ITERATIONS } = payload
    const githubToken = process.env.GITHUB_TOKEN
    logger.info("GitHub token check", { hasToken: !!githubToken, tokenLength: githubToken?.length })

    // Wire up abort signal for cancellation
    const abortController = new AbortController()
    signal.addEventListener("abort", () => abortController.abort())

    // Stream: cloning status
    await statusStream.append({ type: "cloning", message: `Cloning ${repoUrl}...` })

    let repoPath: string
    let cleanup: () => Promise<void>

    try {
      const result = await cloneRepo(repoUrl)
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

      // Wrap user prompt with context about working directory
      const systemContext = `You are working in a cloned git repository at: ${repoPath}
All file paths should be relative to this directory (e.g., "README.md" not "/README.md").
Use the tools available to complete the task.

User task: ${prompt}`

      const agentResult = query({
        prompt: systemContext,
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
              // Log tool use from assistant message
              const toolUses = message.message.content.filter((c: { type: string }) => c.type === "tool_use")
              if (toolUses.length > 0) {
                logger.info("Tool calls", {
                  tools: toolUses.map((t: { name: string; input?: unknown }) => ({ name: t.name, input: t.input }))
                })
              }
            }

            // Log tool results (try different property names)
            if (message.type === "tool_result" || message.type === "tool-result") {
              logger.info("Tool result", { message: JSON.stringify(message).slice(0, 500) })
            }

            // Log all message types we see
            if (!["stream_event", "assistant"].includes(message.type)) {
              logger.info("Other message type", { type: message.type, keys: Object.keys(message) })
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

      // Commit and push if token provided
      let branchUrl: string | null = null
      logger.info("About to commit/push", { hasToken: !!githubToken, repoUrl })
      if (githubToken) {
        try {
          await statusStream.append({ type: "pushing", message: "Creating branch and pushing..." })
          logger.info("Calling commitAndPush")
          branchUrl = await commitAndPush(repoPath, repoUrl, githubToken)
          logger.info("commitAndPush result", { branchUrl })
          if (branchUrl) {
            await statusStream.append({ type: "pushed", message: branchUrl, branchUrl })
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown push error"
          logger.error("Failed to push", { error: message })
          await statusStream.append({ type: "push_failed", message: `Push failed: ${message}` })
        }
      }

      await statusStream.append({ type: "complete", message: `Task complete after ${iterationCount} iterations` })

      return { success: true, iterations: iterationCount, branchUrl }
    } finally {
      // Always cleanup temp directory
      await cleanup()
    }
  },
})
