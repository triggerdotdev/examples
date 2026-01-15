import { task, logger, wait } from "@trigger.dev/sdk"
import { query } from "@anthropic-ai/claude-agent-sdk"
import Anthropic from "@anthropic-ai/sdk"
import { exec } from "child_process"
import { promisify } from "util"
import { mkdtemp, rm, readFile, access, writeFile, appendFile } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"
import { appendStatus, agentOutputStream, appendChatMessage, type TokenUsage, type Prd, type ChatMessage } from "./streams"

const execAsync = promisify(exec)
const anthropic = new Anthropic()

export type RalphLoopPayload = {
  repoUrl: string
  prompt: string
  yoloMode?: boolean // Skip approval gates between stories (default: false)
  maxTurnsPerStory?: number // Max agent turns per story (default: 5)
}

const DEFAULT_MAX_TURNS_PER_STORY = 10

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

// Detect package manager and install dependencies
async function installDeps(repoPath: string): Promise<void> {
  // Check for lockfiles to detect package manager
  const hasFile = async (name: string) => {
    try {
      await access(join(repoPath, name))
      return true
    } catch {
      return false
    }
  }

  let cmd: string | null = null
  if (await hasFile("pnpm-lock.yaml")) {
    cmd = "pnpm install"
  } else if (await hasFile("yarn.lock")) {
    cmd = "yarn install"
  } else if (await hasFile("package-lock.json") || await hasFile("package.json")) {
    cmd = "npm install"
  }

  if (cmd) {
    logger.info("Installing dependencies", { cmd })
    try {
      await execAsync(cmd, { cwd: repoPath, timeout: 300000 }) // 5 min timeout
      logger.info("Dependencies installed")
    } catch (error) {
      const err = error as { message?: string }
      logger.warn("Dependency install failed", { error: err.message })
      // Don't throw - let agent continue and handle if needed
    }
  }
}

function parseGitHubUrl(repoUrl: string): { owner: string; repo: string } | null {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/)
  if (!match) return null
  return { owner: match[1], repo: match[2] }
}

// Shallow exploration of repo structure (token-efficient)
async function exploreRepo(repoPath: string): Promise<string> {
  const parts: string[] = []

  // Get directory structure (top 2 levels)
  try {
    const { stdout } = await execAsync(`find . -maxdepth 2 -type f | head -50`, { cwd: repoPath })
    parts.push(`Files:\n${stdout}`)
  } catch {
    // Fallback to ls
    try {
      const { stdout } = await execAsync(`ls -la`, { cwd: repoPath })
      parts.push(`Directory:\n${stdout}`)
    } catch {
      parts.push("Could not list files")
    }
  }

  // Read package.json if exists
  try {
    const packageJson = await readFile(join(repoPath, "package.json"), "utf-8")
    const pkg = JSON.parse(packageJson)
    parts.push(`package.json:\n- name: ${pkg.name}\n- scripts: ${Object.keys(pkg.scripts || {}).join(", ")}\n- deps: ${Object.keys(pkg.dependencies || {}).join(", ")}`)
  } catch {
    // No package.json
  }

  // Read README first 50 lines if exists
  try {
    const readme = await readFile(join(repoPath, "README.md"), "utf-8")
    const lines = readme.split("\n").slice(0, 50).join("\n")
    parts.push(`README.md (first 50 lines):\n${lines}`)
  } catch {
    // No README
  }

  // Read .env.example if exists (for available env vars)
  try {
    const envExample = await readFile(join(repoPath, ".env.example"), "utf-8")
    parts.push(`.env.example:\n${envExample}`)
  } catch {
    // No .env.example
  }

  return parts.join("\n\n")
}

// Generate PRD from exploration + user prompt
async function generatePrd(exploration: string, prompt: string, repoName: string): Promise<Prd> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `You are generating a PRD (Product Requirements Document) for an autonomous coding agent.

Repo exploration:
${exploration}

User task: ${prompt}

Generate a PRD with 3-7 stories to accomplish this task. Each story should be small and focused.

Output valid JSON only, no markdown fences:
{
  "name": "${repoName}",
  "description": "brief description of the task",
  "stories": [
    {
      "id": "US-001",
      "title": "short title",
      "acceptance": ["criterion 1", "criterion 2"],
      "dependencies": []
    }
  ]
}

Rules:
- Stories should be in dependency order (later stories can depend on earlier ones)
- Each story should be completable in 1-3 agent iterations
- Acceptance criteria should be verifiable
- Use sequential IDs: US-001, US-002, etc.
- For env vars: use existing ones from .env.example if present, or create new ones as needed (user will add values after merge)`,
      },
    ],
  })

  const text = response.content[0]
  if (text.type !== "text") {
    throw new Error("Failed to generate PRD: no text response")
  }

  try {
    // Try to parse, handling potential markdown fences
    let jsonStr = text.text.trim()
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```json?\n?/, "").replace(/\n?```$/, "")
    }
    const prd = JSON.parse(jsonStr) as Prd
    // Ensure all stories start with passes: false
    prd.stories = prd.stories.map(s => ({ ...s, passes: false }))
    return prd
  } catch (e) {
    logger.error("Failed to parse PRD JSON", { text: text.text, error: e })
    throw new Error("Failed to parse PRD: invalid JSON from Claude")
  }
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

export const ralphLoop = task({
  id: "ralph-loop",
  maxDuration: 3600,
  machine: "small-2x",
  run: async (payload: RalphLoopPayload, { signal }) => {
    const { repoUrl, prompt, yoloMode = false, maxTurnsPerStory = DEFAULT_MAX_TURNS_PER_STORY } = payload
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

    // Install dependencies
    await appendStatus({ type: "installing", message: "Installing dependencies..." })
    await installDeps(repoPath)

    try {
      // Phase 1: Shallow exploration
      await appendStatus({ type: "exploring", message: "Exploring repo structure..." })
      const exploration = await exploreRepo(repoPath)
      logger.info("Repo exploration complete", { explorationLength: exploration.length })

      // Phase 2: Generate PRD
      const parsed = parseGitHubUrl(repoUrl)
      const repoName = parsed?.repo ?? "task"
      const prd = await generatePrd(exploration, prompt, repoName)
      logger.info("PRD generated", { stories: prd.stories.length })

      // Phase 3: PRD review waitpoint
      const prdToken = await wait.createToken({ timeout: "24h" })

      await appendStatus({
        type: "prd_review",
        message: `Review and edit PRD (${prd.stories.length} stories)`,
        prd,
        waitpoint: {
          tokenId: prdToken.id,
          publicAccessToken: prdToken.publicAccessToken,
          question: "Review the generated PRD. Edit stories if needed, then approve to start execution.",
        },
      })

      // Stream approval prompt to chat
      await appendChatMessage({
        type: "approval",
        id: `prd-${prdToken.id}`,
        tokenId: prdToken.id,
        publicAccessToken: prdToken.publicAccessToken,
        question: `Generated ${prd.stories.length} stories. Review and edit in the kanban board, then approve to start.`,
        variant: "prd",
        createdAt: Date.now(),
        timeoutMs: 24 * 60 * 60 * 1000, // 24h
      })

      logger.info("Waiting for PRD approval", { tokenId: prdToken.id })

      const prdResult = await wait.forToken<{ action: "approve_prd"; prd: Prd }>(prdToken)

      if (!prdResult.ok) {
        await appendStatus({ type: "error", message: "PRD review timed out after 24h" })
        throw new Error("PRD review timed out")
      }

      // Stream approval response to chat
      await appendChatMessage({
        type: "approval_response",
        id: `prd-${prdToken.id}`,
        action: "Approved & Started",
      })

      // Use the user's edited PRD
      const approvedPrd = prdResult.output.prd
      logger.info("PRD approved", { stories: approvedPrd.stories.length })

      await appendStatus({
        type: "prd_generated",
        message: `PRD approved with ${approvedPrd.stories.length} stories`,
        prd: approvedPrd,
      })

      // Configure git for commits
      await execAsync(`git -C ${repoPath} config user.email "ralph@trigger.dev"`)
      await execAsync(`git -C ${repoPath} config user.name "Ralph (Trigger.dev)"`)

      // Ensure .gitignore exists with common patterns
      const gitignorePath = join(repoPath, ".gitignore")
      const defaultIgnores = `node_modules/
.next/
.turbo/
dist/
build/
.env
.env.local
.DS_Store
*.log
`
      try {
        const existing = await readFile(gitignorePath, "utf-8")
        // Append missing patterns
        if (!existing.includes("node_modules")) {
          await appendFile(gitignorePath, "\n" + defaultIgnores)
        }
      } catch {
        // No .gitignore, create one
        await writeFile(gitignorePath, defaultIgnores)
      }

      // Create branch for all commits (slugify PRD name)
      const slug = approvedPrd.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
      const branchName = `ralph/${slug}`
      await execAsync(`git -C ${repoPath} checkout -b ${branchName}`)

      // Cumulative token usage
      const usage: TokenUsage = {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      }

      // Story-based execution loop
      const stories = approvedPrd.stories.filter(s => !s.passes)
      let completedStories = 0
      let userStopped = false
      const progressLog: string[] = [] // In-memory progress for Ralph loop

      for (let i = 0; i < stories.length && !userStopped; i++) {
        const story = stories[i]
        const storyNum = i + 1
        const totalStories = stories.length

        // Stream story start
        await appendStatus({
          type: "story_start",
          message: `Starting story ${storyNum}/${totalStories}: ${story.title}`,
          story: {
            id: story.id,
            current: storyNum,
            total: totalStories,
            title: story.title,
            acceptance: story.acceptance,
          },
        })

        await appendChatMessage({
          type: "story_separator",
          storyNum,
          totalStories,
          title: story.title,
        })

        // Build story-specific prompt with inline progress (Ralph loop pattern)
        const progressContext = progressLog.length > 0
          ? `\n\n## Previous Stories Completed\n${progressLog.join('\n\n')}\n\nBuild on this work.`
          : ""

        const storyPrompt = `You are working in a cloned git repository at: ${repoPath}
All file paths should be relative to this directory (e.g., "README.md" not "/README.md").

Overall task: ${prompt}
${progressContext}

Current story (${storyNum}/${totalStories}): ${story.title}
Acceptance criteria:
${story.acceptance.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Complete this story. When done, the acceptance criteria should be met. Use Read, Write, Edit, Bash tools to make changes.`

        const agentResult = query({
          prompt: storyPrompt,
          options: {
            model: "claude-sonnet-4-20250514",
            abortController,
            cwd: repoPath,
            maxTurns: maxTurnsPerStory,
            permissionMode: "acceptEdits",
            includePartialMessages: true,
            allowedTools: ["Read", "Edit", "Write", "Bash", "Grep", "Glob"],
          },
        })

        // Stream agent output with structured messages
        const { waitUntilComplete } = agentOutputStream.writer({
          execute: async ({ write }) => {
            // Track current content block for tool use
            let currentToolId: string | undefined

            for await (const message of agentResult) {
              if (message.type === "assistant") {
                const msgUsage = message.message.usage
                if (msgUsage) {
                  usage.inputTokens += msgUsage.input_tokens ?? 0
                  usage.outputTokens += msgUsage.output_tokens ?? 0
                  usage.cacheReadTokens += msgUsage.cache_read_input_tokens ?? 0
                  usage.cacheCreationTokens += msgUsage.cache_creation_input_tokens ?? 0
                }
              }

              if (message.type === "stream_event") {
                const event = message.event

                // Content block start - track tool use
                if (event.type === "content_block_start") {
                  const block = event.content_block
                  if (block.type === "tool_use") {
                    currentToolId = block.id
                    const toolMsg: ChatMessage = {
                      type: "tool_start",
                      id: block.id,
                      name: block.name,
                    }
                    write(JSON.stringify(toolMsg) + "\n")
                  }
                }

                // Content block delta - text or tool input
                if (event.type === "content_block_delta") {
                  const delta = event.delta
                  if (delta.type === "text_delta") {
                    const textMsg: ChatMessage = { type: "text", delta: delta.text }
                    write(JSON.stringify(textMsg) + "\n")
                  } else if (delta.type === "thinking_delta") {
                    const thinkMsg: ChatMessage = { type: "thinking", delta: delta.thinking }
                    write(JSON.stringify(thinkMsg) + "\n")
                  } else if (delta.type === "input_json_delta" && currentToolId) {
                    const inputMsg: ChatMessage = { type: "tool_input", id: currentToolId, delta: delta.partial_json }
                    write(JSON.stringify(inputMsg) + "\n")
                  }
                }

                // Content block stop - end tool use
                if (event.type === "content_block_stop" && currentToolId) {
                  const endMsg: ChatMessage = { type: "tool_end", id: currentToolId }
                  write(JSON.stringify(endMsg) + "\n")
                  currentToolId = undefined
                }
              }
            }
          },
        })

        await waitUntilComplete()

        // Check for changes and commit
        let storyCommitHash: string | undefined
        const { stdout: status } = await execAsync(`git -C ${repoPath} status --porcelain`)
        if (status.trim()) {
          await execAsync(`git -C ${repoPath} add -A`)
          await execAsync(`git -C ${repoPath} commit -m "${story.title.replace(/"/g, '\\"')}"`)
          const { stdout: hash } = await execAsync(`git -C ${repoPath} rev-parse HEAD`)
          storyCommitHash = hash.trim()
          logger.info("Committed story", { story: story.title, commitHash: storyCommitHash })
        }

        // Run build check if package.json has build script
        let buildFailed = false
        let buildError = ""
        try {
          const pkgPath = join(repoPath, "package.json")
          const pkg = JSON.parse(await readFile(pkgPath, "utf-8"))
          if (pkg.scripts?.build) {
            await execAsync(`npm run build`, { cwd: repoPath, timeout: 120000 })
            logger.info("Build passed for story", { story: story.title })
          }
        } catch (error) {
          const err = error as { message?: string; stderr?: string; stdout?: string }
          // Only mark as build failure if it's not missing package.json
          if (!err.message?.includes("ENOENT")) {
            buildFailed = true
            // Capture build output for error display
            buildError = err.stderr || err.stdout || err.message || "Build failed"
            buildError = buildError.slice(-500) // Keep last 500 chars
            logger.warn("Build failed for story", { story: story.title, error: err.message })
            await appendChatMessage({ type: "text", delta: `\n[Build failed: ${buildError.slice(0, 200)}]\n` })
          }
        }

        // Handle story failure (build failed)
        if (buildFailed) {
          // Capture per-story diff for UI even on failure
          let storyDiff = ""
          if (storyCommitHash) {
            try {
              const { stdout: diff } = await execAsync(`git -C ${repoPath} diff HEAD~1`)
              storyDiff = diff
            } catch {
              // No diff available
            }
          }

          await appendStatus({
            type: "story_failed",
            message: `Story ${storyNum}/${totalStories} failed: ${story.title}`,
            storyError: buildError,
            story: {
              id: story.id,
              current: storyNum,
              total: totalStories,
              title: story.title,
              acceptance: story.acceptance,
              diff: storyDiff || undefined,
            },
            commitHash: storyCommitHash,
            usage,
          })

          // Continue to next story (don't block on failure)
          continue
        }

        completedStories++

        // Update in-memory progress (Ralph loop pattern - no file in repo)
        progressLog.push(`### ${story.title}\n- ${story.acceptance.join('\n- ')}`)

        // Capture per-story diff for UI
        let storyDiff = ""
        if (storyCommitHash) {
          try {
            const { stdout: diff } = await execAsync(`git -C ${repoPath} diff HEAD~1`)
            storyDiff = diff
          } catch {
            // No diff available
          }
        }

        // Story complete status (commit URLs only available after push)
        await appendStatus({
          type: "story_complete",
          message: `Completed story ${storyNum}/${totalStories}: ${story.title}`,
          story: {
            id: story.id,
            current: storyNum,
            total: totalStories,
            title: story.title,
            acceptance: story.acceptance,
            diff: storyDiff || undefined,
          },
          commitHash: storyCommitHash,
          progress: progressLog.join('\n\n'),
          usage,
        })

        // Approval gate (unless yolo mode or last story)
        const isLastStory = i === stories.length - 1
        if (!yoloMode && !isLastStory) {
          const token = await wait.createToken({ timeout: "24h" })

          // Get current diff
          let currentDiff = ""
          try {
            const { stdout: diff } = await execAsync(`git -C ${repoPath} diff HEAD~1`)
            currentDiff = diff
          } catch {
            // No diff
          }

          await appendStatus({
            type: "waitpoint",
            message: `Story "${story.title}" complete. Continue to next story?`,
            diff: currentDiff,
            story: {
              id: story.id,
              current: storyNum,
              total: totalStories,
              title: story.title,
              acceptance: story.acceptance,
            },
            commitHash: storyCommitHash,
            waitpoint: {
              tokenId: token.id,
              publicAccessToken: token.publicAccessToken,
              question: `Completed ${storyNum}/${totalStories} stories. Continue to "${stories[i + 1]?.title}"?`,
            },
          })

          // Stream approval prompt to chat
          await appendChatMessage({
            type: "approval",
            id: `story-${token.id}`,
            tokenId: token.id,
            publicAccessToken: token.publicAccessToken,
            question: `Story "${story.title}" complete. Continue to "${stories[i + 1]?.title}"?`,
            variant: "story",
            createdAt: Date.now(),
            timeoutMs: 24 * 60 * 60 * 1000, // 24h
          })

          const result = await wait.forToken<{ action: "continue" | "stop" | "approve_complete" }>(token)

          if (!result.ok || result.output.action === "stop") {
            userStopped = true
            await appendChatMessage({
              type: "approval_response",
              id: `story-${token.id}`,
              action: "Stopped",
            })
          } else if (result.output.action === "approve_complete") {
            await appendChatMessage({
              type: "approval_response",
              id: `story-${token.id}`,
              action: "Approved & Completed",
            })
            // Skip remaining stories, go straight to push
            break
          } else {
            // Continue
            await appendChatMessage({
              type: "approval_response",
              id: `story-${token.id}`,
              action: "Continue",
            })
          }
        }
      }

      // Final diff summary
      try {
        const { stdout: diff } = await execAsync(`git -C ${repoPath} log --oneline ${branchName} ^HEAD~${completedStories}`)
        if (diff) {
          await appendStatus({
            type: "diff",
            message: `Commits:\n${diff}`,
            diff,
          })
        }
      } catch {
        // Git log failed
      }

      // Push if token provided and we have commits
      let branchUrl: string | null = null
      let prUrl: string | null = null

      if (githubToken && completedStories > 0) {
        const parsedUrl = parseGitHubUrl(repoUrl)
        if (parsedUrl) {
          try {
            await appendStatus({ type: "pushing", message: "Pushing branch and creating PR..." })

            // Set up authenticated remote and push
            const authUrl = `https://${githubToken}@github.com/${parsedUrl.owner}/${parsedUrl.repo}.git`
            await execAsync(`git -C ${repoPath} remote set-url origin ${authUrl}`)
            await execAsync(`git -C ${repoPath} push -u origin ${branchName}`)

            branchUrl = `https://github.com/${parsedUrl.owner}/${parsedUrl.repo}/tree/${branchName}`

            // Create PR
            prUrl = await createPullRequest(
              parsedUrl.owner,
              parsedUrl.repo,
              branchName,
              `${approvedPrd.name}: ${completedStories} stories`,
              githubToken
            )

            const message = prUrl ?? branchUrl
            await appendStatus({ type: "pushed", message, branchUrl, prUrl: prUrl ?? undefined })
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown push error"
            logger.error("Failed to push", { error: message })
            await appendStatus({ type: "push_failed", message: `Push failed: ${message}` })
          }
        }
      }

      await appendStatus({
        type: "complete",
        message: `Completed ${completedStories}/${stories.length} stories`,
        usage,
      })

      return { success: true, storiesCompleted: completedStories, branchUrl, prUrl, usage }
    } finally {
      // Always cleanup temp directory
      await cleanup()
    }
  },
})
