import { task, logger, wait } from "@trigger.dev/sdk"
import { query } from "@anthropic-ai/claude-agent-sdk"
import Anthropic from "@anthropic-ai/sdk"
import { exec } from "child_process"
import { promisify } from "util"
import { mkdtemp, rm, readFile } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"
import { appendStatus, agentOutputStream, type TokenUsage } from "./streams"

const execAsync = promisify(exec)
const anthropic = new Anthropic()

const DEFAULT_PAUSE_EVERY = 5

type TestResult = { hasTests: false } | { hasTests: true; passed: boolean; output: string }

async function runTestsIfExist(repoPath: string): Promise<TestResult> {
  try {
    const packageJsonPath = join(repoPath, "package.json")
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8"))

    // Check if test script exists and is meaningful
    const testScript = packageJson.scripts?.test
    if (!testScript || testScript.includes("no test specified")) {
      return { hasTests: false }
    }

    logger.info("Running tests", { testScript })

    try {
      const { stdout, stderr } = await execAsync("npm test", {
        cwd: repoPath,
        timeout: 120000 // 2 minute timeout
      })
      logger.info("Tests passed", { stdout: stdout.slice(-500) })
      return { hasTests: true, passed: true, output: stdout + stderr }
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; message?: string }
      const output = (err.stdout ?? "") + (err.stderr ?? "") + (err.message ?? "")
      logger.info("Tests failed", { output: output.slice(-500) })
      return { hasTests: true, passed: false, output }
    }
  } catch {
    // No package.json or parse error
    return { hasTests: false }
  }
}

export type RalphLoopPayload = {
  repoUrl: string
  prompt: string
  maxIterations?: number // Default: 10
  pauseEvery?: number // Pause for approval every N iterations (default: 5, 0 = no pauses)
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

async function createPullRequest(
  owner: string,
  repo: string,
  branchName: string,
  title: string,
  githubToken: string
): Promise<string | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify({
        title,
        head: branchName,
        base: "main",
        body: "Created by Ralph (Trigger.dev agent)",
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      logger.error("Failed to create PR", { status: response.status, error })
      return null
    }

    const pr = (await response.json()) as { html_url: string }
    return pr.html_url
  } catch (error) {
    logger.error("PR creation error", { error })
    return null
  }
}

async function commitAndPush(
  repoPath: string,
  repoUrl: string,
  githubToken: string
): Promise<{ branchUrl: string; prUrl: string | null } | null> {
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

  const branchUrl = `https://github.com/${parsed.owner}/${parsed.repo}/tree/${branchName}`

  // Create PR
  const prUrl = await createPullRequest(parsed.owner, parsed.repo, branchName, commitMessage, githubToken)

  return { branchUrl, prUrl }
}

export const ralphLoop = task({
  id: "ralph-loop",
  maxDuration: 3600,
  machine: "small-2x",
  run: async (payload: RalphLoopPayload, { signal }) => {
    const { repoUrl, prompt, maxIterations = DEFAULT_MAX_ITERATIONS, pauseEvery = DEFAULT_PAUSE_EVERY } = payload
    const githubToken = process.env.GITHUB_TOKEN
    logger.info("GitHub token check", { hasToken: !!githubToken, tokenLength: githubToken?.length })

    // Wire up abort signal for cancellation
    const abortController = new AbortController()
    signal.addEventListener("abort", () => abortController.abort())

    // Stream: cloning status
    await appendStatus({ type: "cloning", message: `Cloning ${repoUrl}...` })

    let repoPath: string
    let cleanup: () => Promise<void>

    try {
      const result = await cloneRepo(repoUrl)
      repoPath = result.path
      cleanup = result.cleanup
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown clone error"
      await appendStatus({ type: "error", message: `Clone failed: ${message}` })
      throw new Error(`Failed to clone repository: ${message}`)
    }

    await appendStatus({ type: "cloned", message: `Cloned to ${repoPath}` })

    try {
      // Run Claude Agent SDK loop with approval gates
      await appendStatus({ type: "working", message: "Starting agent loop..." })

      let totalIterations = 0
      const feedbackHistory: string[] = []
      const shouldPause = pauseEvery > 0

      // Cumulative token usage
      const usage: TokenUsage = {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      }

      // Outer loop: runs agent in segments, pausing for approval between them
      while (totalIterations < maxIterations) {
        const iterationsRemaining = maxIterations - totalIterations
        const segmentSize = shouldPause ? Math.min(pauseEvery, iterationsRemaining) : iterationsRemaining

        // Build prompt with feedback context
        const feedbackContext = feedbackHistory.length > 0
          ? `\n\nUser feedback from previous checkpoints:\n${feedbackHistory.map((f, i) => `${i + 1}. ${f}`).join("\n")}\n\nContinue with this feedback in mind.`
          : ""

        const systemContext = `You are working in a cloned git repository at: ${repoPath}
All file paths should be relative to this directory (e.g., "README.md" not "/README.md").
Use the tools available to complete the task.

User task: ${prompt}${feedbackContext}`

        const agentResult = query({
          prompt: systemContext,
          options: {
            model: "claude-sonnet-4-20250514",
            abortController,
            cwd: repoPath,
            maxTurns: segmentSize,
            permissionMode: "acceptEdits",
            includePartialMessages: true,
            allowedTools: ["Read", "Edit", "Write", "Bash", "Grep", "Glob"],
          },
        })

        // Track if Claude completed naturally vs hit turn limit
        let claudeCompletedNaturally = false
        let resultMessage: string | undefined

        // Use writer pattern for streaming agent output
        const { waitUntilComplete } = agentOutputStream.writer({
          execute: async ({ write }) => {
            for await (const message of agentResult) {
              logger.info("Agent message", { type: message.type })

              if (message.type === "assistant") {
                totalIterations++

                // Extract usage from this turn
                const msgUsage = message.message.usage
                if (msgUsage) {
                  usage.inputTokens += msgUsage.input_tokens ?? 0
                  usage.outputTokens += msgUsage.output_tokens ?? 0
                  usage.cacheReadTokens += msgUsage.cache_read_input_tokens ?? 0
                  usage.cacheCreationTokens += msgUsage.cache_creation_input_tokens ?? 0
                }

                await appendStatus({
                  type: "iteration",
                  message: `Iteration ${totalIterations}/${maxIterations}`,
                  iteration: totalIterations,
                  usage,
                })

                const toolUses = message.message.content.filter((c) => c.type === "tool_use")
                if (toolUses.length > 0) {
                  logger.info("Tool calls", {
                    tools: toolUses.map((t) => {
                      const tool = t as unknown as { name: string; input?: unknown }
                      return { name: tool.name, input: tool.input }
                    })
                  })
                }
              }

              // Capture result message to detect completion
              if (message.type === "result") {
                logger.info("Result message", { subtype: message.subtype })
                if (message.subtype === "success") {
                  claudeCompletedNaturally = true
                  resultMessage = message.result
                }
              }

              if (!["stream_event", "assistant", "result"].includes(message.type)) {
                logger.info("Other message type", { type: message.type, keys: Object.keys(message) })
              }

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

        // If Claude completed naturally, exit the loop
        if (claudeCompletedNaturally) {
          logger.info("Claude completed task naturally", { resultMessage })
          await appendStatus({
            type: "agent_complete",
            message: "Claude completed the task",
          })
          break
        }

        // Run tests if they exist - exit early if they pass
        const testResult = await runTestsIfExist(repoPath)
        if (testResult.hasTests) {
          if (testResult.passed) {
            logger.info("Tests passed - exiting loop")
            await appendStatus({
              type: "tests_passed",
              message: "Tests passed",
            })
            break
          } else {
            logger.info("Tests failed - continuing")
            await appendStatus({
              type: "tests_failed",
              message: "Tests failed, continuing...",
            })
          }
        }

        // Check if we should pause for approval
        const moreIterationsAvailable = totalIterations < maxIterations
        if (shouldPause && moreIterationsAvailable) {
          // Get current diff for context
          let currentDiff = ""
          try {
            const { stdout: diff } = await execAsync(`git -C ${repoPath} diff`)
            const { stdout: status } = await execAsync(`git -C ${repoPath} status --short`)
            currentDiff = status ? `Files changed:\n${status}\n\n${diff}` : ""
          } catch {
            // Git diff failed, continue without it
          }

          // Create waitpoint for approval
          const token = await wait.createToken({ timeout: "24h" })

          await appendStatus({
            type: "waitpoint",
            message: `Completed ${totalIterations} iterations. Continue, provide feedback, or stop?`,
            diff: currentDiff,
            waitpoint: {
              tokenId: token.id,
              publicAccessToken: token.publicAccessToken,
              question: `Completed ${totalIterations}/${maxIterations} iterations. Review progress and choose to continue, provide feedback, or stop.`,
            },
          })

          logger.info("Waiting for approval", { tokenId: token.id, totalIterations })

          const result = await wait.forToken<{ action: "continue" | "stop" | "approve_complete"; feedback?: string }>(token)

          if (!result.ok) {
            logger.warn("Approval waitpoint timed out")
            await appendStatus({ type: "error", message: "Approval timed out after 24h" })
            break
          }

          if (result.output.action === "stop") {
            logger.info("User stopped the run")
            await agentOutputStream.append("\n\n[User stopped the run]\n")
            break
          }

          if (result.output.action === "approve_complete") {
            logger.info("User approved and completed the run")
            await agentOutputStream.append("\n\n[User approved and completed]\n")
            await appendStatus({
              type: "user_approved",
              message: "User approved the changes",
            })
            break
          }

          // User chose to continue
          if (result.output.feedback) {
            feedbackHistory.push(result.output.feedback)
            await agentOutputStream.append(`\n\n[User feedback: ${result.output.feedback}]\n\n`)
          }

          await appendStatus({ type: "working", message: "Resuming..." })
        } else {
          // No more pauses needed or max iterations reached
          break
        }
      }

      // Show what changed before cleanup
      try {
        const { stdout: diff } = await execAsync(`git -C ${repoPath} diff`)
        const { stdout: status } = await execAsync(`git -C ${repoPath} status --short`)
        if (diff || status) {
          await appendStatus({
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
      let prUrl: string | null = null
      logger.info("About to commit/push", { hasToken: !!githubToken, repoUrl })
      if (githubToken) {
        try {
          await appendStatus({ type: "pushing", message: "Creating branch and PR..." })
          logger.info("Calling commitAndPush")
          const result = await commitAndPush(repoPath, repoUrl, githubToken)
          logger.info("commitAndPush result", { result })
          if (result) {
            branchUrl = result.branchUrl
            prUrl = result.prUrl
            const message = prUrl ?? result.branchUrl
            await appendStatus({ type: "pushed", message, branchUrl, prUrl: prUrl ?? undefined })
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown push error"
          logger.error("Failed to push", { error: message })
          await appendStatus({ type: "push_failed", message: `Push failed: ${message}` })
        }
      }

      await appendStatus({
        type: "complete",
        message: `Task complete after ${totalIterations} iterations`,
        usage,
      })

      return { success: true, iterations: totalIterations, branchUrl, prUrl, usage }
    } finally {
      // Always cleanup temp directory
      await cleanup()
    }
  },
})
