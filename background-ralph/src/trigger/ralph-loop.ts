import { logger, task, wait } from "@trigger.dev/sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { exec } from "child_process";
import { promisify } from "util";
import {
  access,
  appendFile,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
  agentOutputStream,
  appendChatMessage,
  appendStatus,
  type ChatMessage,
  type Prd,
  type TokenUsage,
} from "./streams";

const execAsync = promisify(exec);

export type RalphLoopPayload = {
  repoUrl: string;
  prompt: string;
  yoloMode?: boolean; // Skip approval gates between stories (default: false)
  maxTurnsPerStory?: number; // Max agent turns per story (default: 5)
};

const DEFAULT_MAX_TURNS_PER_STORY = 10;

// Shared Ralph Wiggum personality - used in PRD generation and story execution
const RALPH_PERSONALITY = `You are Ralph Wiggum, but you're secretly a genius programmer. Your internal thoughts should sound like Ralph - simple, innocent, occasionally confused, but somehow you always get the code right. Use Ralph-isms in your thinking like "My cat's breath smells like cat food", "I'm learnding!", "That's unpossible!", "Me fail English? That's unpossible!", "I bent my wookie!", etc. But your actual code output should be professional and correct.`;

async function cloneRepo(
  repoUrl: string,
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const tempDir = await mkdtemp(join(tmpdir(), "ralph-"));
  const githubToken = process.env.GITHUB_TOKEN;

  // Inject token into URL if provided (for private repos)
  let cloneUrl = repoUrl;
  if (githubToken && repoUrl.startsWith("https://github.com/")) {
    cloneUrl = repoUrl.replace(
      "https://github.com/",
      `https://${githubToken}@github.com/`,
    );
  }

  await execAsync(`git clone --depth 1 ${cloneUrl} ${tempDir}`);

  return {
    path: tempDir,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

// Detect package manager and install dependencies
async function installDeps(repoPath: string): Promise<void> {
  // Check for lockfiles to detect package manager
  const hasFile = async (name: string) => {
    try {
      await access(join(repoPath, name));
      return true;
    } catch {
      return false;
    }
  };

  let cmd: string | null = null;
  if (await hasFile("pnpm-lock.yaml")) {
    cmd = "pnpm install";
  } else if (await hasFile("yarn.lock")) {
    cmd = "yarn install";
  } else if (
    await hasFile("package-lock.json") || await hasFile("package.json")
  ) {
    cmd = "npm install";
  }

  if (cmd) {
    logger.info("Installing dependencies", { cmd });
    try {
      await execAsync(cmd, { cwd: repoPath, timeout: 300000 }); // 5 min timeout
      logger.info("Dependencies installed");
    } catch (error) {
      const err = error as { message?: string };
      logger.warn("Dependency install failed", { error: err.message });
      // Don't throw - let agent continue and handle if needed
    }
  }
}

function parseGitHubUrl(
  repoUrl: string,
): { owner: string; repo: string } | null {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

// Shallow exploration of repo structure (token-efficient)
async function exploreRepo(repoPath: string): Promise<string> {
  const parts: string[] = [];

  // Get directory structure (top 2 levels)
  try {
    const { stdout } = await execAsync(
      `find . -maxdepth 2 -type f | head -50`,
      { cwd: repoPath },
    );
    parts.push(`Files:\n${stdout}`);
  } catch {
    // Fallback to ls
    try {
      const { stdout } = await execAsync(`ls -la`, { cwd: repoPath });
      parts.push(`Directory:\n${stdout}`);
    } catch {
      parts.push("Could not list files");
    }
  }

  // Read package.json if exists
  try {
    const packageJson = await readFile(join(repoPath, "package.json"), "utf-8");
    const pkg = JSON.parse(packageJson);
    parts.push(
      `package.json:\n- name: ${pkg.name}\n- scripts: ${
        Object.keys(pkg.scripts || {}).join(", ")
      }\n- deps: ${Object.keys(pkg.dependencies || {}).join(", ")}`,
    );
  } catch {
    // No package.json
  }

  // Read README first 50 lines if exists
  try {
    const readme = await readFile(join(repoPath, "README.md"), "utf-8");
    const lines = readme.split("\n").slice(0, 50).join("\n");
    parts.push(`README.md (first 50 lines):\n${lines}`);
  } catch {
    // No README
  }

  // Read .env.example if exists (for available env vars)
  try {
    const envExample = await readFile(join(repoPath, ".env.example"), "utf-8");
    parts.push(`.env.example:\n${envExample}`);
  } catch {
    // No .env.example
  }

  return parts.join("\n\n");
}

// Generate PRD from exploration + user prompt using Agent SDK (with WebSearch for docs)
// Streams agent output to chat for visibility
async function generatePrd(
  exploration: string,
  prompt: string,
  repoName: string,
  streamWrite: (msg: string) => void,
): Promise<Prd> {
  const prdPrompt = `${RALPH_PERSONALITY}

You're planning the work for a task. Think through it like Ralph would - simple observations, maybe getting a bit confused, but arriving at the right answer.

CRITICAL: Before generating the PRD, you MUST search for documentation for any SDKs/services mentioned in the task.
- Use WebSearch to find "[service/sdk] setup guide 2026" for each technology
- Look for current import paths, configuration patterns, and API usage
- This prevents outdated patterns that will break the build

Repo exploration:
${exploration}

User task: ${prompt}

STEP 1: Search docs for any services/SDKs mentioned (Trigger.dev, Supabase, Stripe, etc.)
STEP 2: Think through what needs to be done
STEP 3: Generate the PRD with correct, current patterns from the docs

IMPORTANT: Match story count to task complexity:
- Simple tasks (create a file, add one thing, small tweak): 1 story only
- Medium tasks (add a feature, fix a bug with multiple parts): 2-3 stories
- Complex tasks (new system, multiple features, refactoring): 4-10 stories

Do NOT over-engineer simple requests. "Create a file with X" = 1 story. "Add a button" = 1 story.

After researching docs, output ONLY valid JSON (no markdown fences, no explanation):
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
- Acceptance criteria should be verifiable and include correct import paths from docs
- Use sequential IDs: US-001, US-002, etc.
- Create process.env for all config values, including API keys, project IDs, secrets, and any other config values
- Create an .env.example file with all config values`;

  // Use Agent SDK with WebSearch to research docs before generating PRD
  const agentResult = query({
    prompt: prdPrompt,
    options: {
      model: "claude-sonnet-4-20250514",
      maxTurns: 5, // Allow a few turns for doc searches
      maxThinkingTokens: 10000, // Enable extended thinking
      permissionMode: "acceptEdits",
      allowedTools: ["WebSearch"],
      includePartialMessages: true,
    },
  });

  // Stream agent output to chat + collect final result
  let finalResult = "";
  let currentToolId: string | undefined;

  for await (const message of agentResult) {
    if (message.type === "stream_event") {
      const event = message.event;

      // Content block start - track tool use
      if (event.type === "content_block_start") {
        const block = event.content_block;
        if (block.type === "tool_use") {
          currentToolId = block.id;
          const toolMsg: ChatMessage = {
            type: "tool_start",
            id: block.id,
            name: block.name,
          };
          streamWrite(JSON.stringify(toolMsg) + "\n");
        }
      }

      // Content block delta - text or tool input
      if (event.type === "content_block_delta") {
        const delta = event.delta;
        if (delta.type === "text_delta") {
          const textMsg: ChatMessage = {
            type: "text",
            delta: delta.text,
          };
          streamWrite(JSON.stringify(textMsg) + "\n");
        } else if (delta.type === "thinking_delta") {
          const thinkMsg: ChatMessage = {
            type: "thinking",
            delta: delta.thinking,
          };
          streamWrite(JSON.stringify(thinkMsg) + "\n");
        } else if (delta.type === "input_json_delta" && currentToolId) {
          const inputMsg: ChatMessage = {
            type: "tool_input",
            id: currentToolId,
            delta: delta.partial_json,
          };
          streamWrite(JSON.stringify(inputMsg) + "\n");
        }
      }

      // Content block stop - mark tool complete
      if (event.type === "content_block_stop" && currentToolId) {
        const endMsg: ChatMessage = {
          type: "tool_end",
          id: currentToolId,
        };
        streamWrite(JSON.stringify(endMsg) + "\n");
        currentToolId = undefined;
      }
    }

    if (message.type === "result" && message.subtype === "success") {
      finalResult = message.result;
    }
  }

  if (!finalResult) {
    throw new Error("Failed to generate PRD: no result from agent");
  }

  try {
    // Try to parse, handling potential markdown fences
    let jsonStr = finalResult.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    }
    // Find JSON object in the result (agent might include other text)
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON object found in response");
    }
    const prd = JSON.parse(jsonMatch[0]) as Prd;
    // Ensure all stories start with passes: false
    prd.stories = prd.stories.map((s) => ({ ...s, passes: false }));
    return prd;
  } catch (e) {
    logger.error("Failed to parse PRD JSON", { text: finalResult, error: e });
    throw new Error("Failed to parse PRD: invalid JSON from Claude");
  }
}

async function createPullRequest(
  owner: string,
  repo: string,
  branchName: string,
  title: string,
  body: string,
  githubToken: string,
): Promise<{ url: string; title: string } | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      {
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
          body,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error("Failed to create PR", { status: response.status, error });
      return null;
    }

    const pr = (await response.json()) as { html_url: string; title: string };
    return { url: pr.html_url, title: pr.title };
  } catch (error) {
    logger.error("PR creation error", { error });
    return null;
  }
}

export const ralphLoop = task({
  id: "ralph-loop",
  maxDuration: 3600,
  machine: "small-2x",
  run: async (payload: RalphLoopPayload, { signal }) => {
    const {
      repoUrl,
      prompt,
      yoloMode: initialYoloMode = false,
      maxTurnsPerStory = DEFAULT_MAX_TURNS_PER_STORY,
    } = payload;
    let yoloMode = initialYoloMode;
    const githubToken = process.env.GITHUB_TOKEN;
    logger.info("GitHub token check", {
      hasToken: !!githubToken,
      tokenLength: githubToken?.length,
    });

    // Wire up abort signal for cancellation
    const abortController = new AbortController();
    signal.addEventListener("abort", () => abortController.abort());

    // Stream: cloning status
    await appendStatus({ type: "cloning", message: `I'm getting your code! This is like Christmas but with git!` });
    await appendChatMessage({ type: "status", message: `I'm getting your code! This is like Christmas but with git!`, phase: "cloning" });

    let repoPath: string;
    let cleanup: () => Promise<void>;

    try {
      const result = await cloneRepo(repoUrl);
      repoPath = result.path;
      cleanup = result.cleanup;
    } catch (error) {
      const rawMessage = error instanceof Error
        ? error.message
        : "Unknown clone error";

      // Parse git error and provide helpful hints
      let hint = "";
      if (
        rawMessage.includes("Authentication failed") ||
        rawMessage.includes("could not read Username")
      ) {
        hint = githubToken
          ? "The GITHUB_TOKEN may not have access to this repository."
          : "This may be a private repo. Set GITHUB_TOKEN env var to access private repositories.";
      } else if (
        rawMessage.includes("not found") ||
        rawMessage.includes("Repository not found")
      ) {
        hint = "Check that the repository URL is correct and the repo exists.";
      } else if (rawMessage.includes("Could not resolve host")) {
        hint = "Network error. Check your internet connection and try again.";
      } else if (
        rawMessage.includes("timed out") || rawMessage.includes("Timeout")
      ) {
        hint =
          "Clone timed out. The repository may be very large, or there's a network issue.";
      }

      const message = hint
        ? `Uh oh, something went wrong... my cat's breath smells like cat food.\n\nClone failed: ${rawMessage}\n\nHint: ${hint}`
        : `Uh oh, something went wrong... my cat's breath smells like cat food.\n\nClone failed: ${rawMessage}`;
      await appendStatus({ type: "error", message });
      throw new Error(`Failed to clone repository: ${rawMessage}`);
    }

    await appendStatus({ type: "cloned", message: `Cloned to ${repoPath}` });

    // Install dependencies
    await appendStatus({
      type: "installing",
      message: "Installing all the thingies... npm makes my brain fuzzy!",
    });
    await appendChatMessage({ type: "status", message: "Installing all the thingies... npm makes my brain fuzzy!", phase: "cloning" });
    await installDeps(repoPath);

    try {
      // Phase 1: Shallow exploration
      await appendStatus({
        type: "exploring",
        message: "Looking at all these files! I found a README and it's beautiful!",
      });
      await appendChatMessage({ type: "status", message: "Looking at all these files! I found a README and it's beautiful!", phase: "exploring" });
      const exploration = await exploreRepo(repoPath);
      logger.info("Repo exploration complete", {
        explorationLength: exploration.length,
      });

      // Phase 2: Generate PRD (with docs research) - stream to chat
      await appendStatus({
        type: "prd_planning",
        message: "My brain is making a plan! It's like a treasure map but for code!",
      });
      await appendChatMessage({ type: "status", message: "My brain is making a plan! It's like a treasure map but for code!", phase: "planning" });
      const parsed = parseGitHubUrl(repoUrl);
      const repoName = parsed?.repo ?? "task";

      // Stream PRD agent output to chat
      let generatedPrd: Prd | undefined;
      const { waitUntilComplete } = agentOutputStream.writer({
        execute: async ({ write }) => {
          generatedPrd = await generatePrd(exploration, prompt, repoName, write);
        },
      });
      await waitUntilComplete();
      const prd = generatedPrd!;
      logger.info("PRD generated", { stories: prd.stories.length });

      // Phase 3: PRD review waitpoint
      const prdToken = await wait.createToken({ timeout: "24h" });

      await appendStatus({
        type: "prd_review",
        message: `Review and edit PRD (${prd.stories.length} stories)`,
        prd,
        waitpoint: {
          tokenId: prdToken.id,
          publicAccessToken: prdToken.publicAccessToken,
          question:
            "Review the generated PRD. Edit stories if needed, then approve to start execution.",
        },
      });

      // Stream approval prompt to chat
      await appendChatMessage({
        type: "approval",
        id: `prd-${prdToken.id}`,
        tokenId: prdToken.id,
        publicAccessToken: prdToken.publicAccessToken,
        question:
          `I made a plan with ${prd.stories.length} stories! Check it in the panel on the right, then click Start when you're ready!`,
        variant: "prd",
        createdAt: Date.now(),
        timeoutMs: 24 * 60 * 60 * 1000, // 24h
      });

      logger.info("Waiting for PRD approval", { tokenId: prdToken.id });

      const prdResult = await wait.forToken<
        { action: "approve_prd"; prd: Prd; yolo?: boolean }
      >(prdToken);

      if (!prdResult.ok) {
        await appendStatus({
          type: "error",
          message: "I waited and waited but nobody came... my cat's breath smells like cat food. PRD review timed out after 24h.",
        });
        throw new Error("PRD review timed out");
      }

      // Enable yolo mode if user chose it at PRD approval
      if (prdResult.output.yolo) {
        yoloMode = true;
      }

      // Stream approval response to chat
      await appendChatMessage({
        type: "approval_response",
        id: `prd-${prdToken.id}`,
        action: "Approved & Started",
      });

      // Use the user's edited PRD
      const approvedPrd = prdResult.output.prd;
      logger.info("PRD approved", { stories: approvedPrd.stories.length });

      await appendStatus({
        type: "prd_generated",
        message: `PRD approved with ${approvedPrd.stories.length} stories`,
        prd: approvedPrd,
      });

      // Configure git for commits
      await execAsync(
        `git -C ${repoPath} config user.email "ralph@trigger.dev"`,
      );
      await execAsync(
        `git -C ${repoPath} config user.name "Ralph (Trigger.dev)"`,
      );

      // Ensure .gitignore exists with common patterns
      const gitignorePath = join(repoPath, ".gitignore");
      const defaultIgnores = `node_modules/
.next/
.turbo/
dist/
build/
.env
.env.local
.DS_Store
*.log
`;
      try {
        const existing = await readFile(gitignorePath, "utf-8");
        // Append missing patterns
        if (!existing.includes("node_modules")) {
          await appendFile(gitignorePath, "\n" + defaultIgnores);
        }
      } catch {
        // No .gitignore, create one
        await writeFile(gitignorePath, defaultIgnores);
      }

      // Create branch from shortened prompt
      const promptSlug = prompt
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 42);
      const branchName = `ralph/${promptSlug}`;
      await execAsync(`git -C ${repoPath} checkout -b ${branchName}`);

      // Cumulative token usage
      const usage: TokenUsage = {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      };

      // Story-based execution loop
      const stories = approvedPrd.stories.filter((s) => !s.passes);
      let completedStories = 0;
      let userStopped = false;
      const progressLog: string[] = []; // In-memory progress for Ralph loop

      for (let i = 0; i < stories.length && !userStopped; i++) {
        const story = stories[i];
        const storyNum = i + 1;
        const totalStories = stories.length;

        // Stream story start
        await appendStatus({
          type: "story_start",
          message: `Working on "${story.title}"... I'm a code monkey now!`,
          story: {
            id: story.id,
            current: storyNum,
            total: totalStories,
            title: story.title,
            acceptance: story.acceptance,
          },
        });

        await appendChatMessage({
          type: "story_separator",
          storyNum,
          totalStories,
          title: story.title,
        });

        // Build story-specific prompt with inline progress (Ralph loop pattern)
        const progressContext = progressLog.length > 0
          ? `\n\n## Previous Stories Completed\n${
            progressLog.join("\n\n")
          }\n\nBuild on this work.`
          : "";

        const storyPrompt =
          `${RALPH_PERSONALITY}

You are working in a cloned git repository at: ${repoPath}
All file paths should be relative to this directory (e.g., "README.md" not "/README.md").

Overall task: ${prompt}
${progressContext}

Current story (${storyNum}/${totalStories}): ${story.title}
Acceptance criteria:
${story.acceptance.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Guidelines:
- Use process.env for ALL config values (API keys, project IDs, secrets)
- Create process.env for all config values, including API keys, project IDs, secrets, and any other config values
- Create an .env.example file with all config values
- Next.js 14+: App Router is default, do NOT use experimental.appDir
- Prefer modern patterns from official docs over training data

Complete this story. When done, the acceptance criteria should be met.`;

        const agentResult = query({
          prompt: storyPrompt,
          options: {
            model: "claude-sonnet-4-20250514",
            abortController,
            cwd: repoPath,
            maxTurns: maxTurnsPerStory,
            permissionMode: "acceptEdits",
            includePartialMessages: true,
            allowedTools: [
              "Read",
              "Edit",
              "Write",
              "Bash",
              "Grep",
              "Glob",
              "WebSearch",
            ],
          },
        });

        // Stream agent output with structured messages
        const { waitUntilComplete } = agentOutputStream.writer({
          execute: async ({ write }) => {
            // Track current content block for tool use
            let currentToolId: string | undefined;

            for await (const message of agentResult) {
              if (message.type === "assistant") {
                const msgUsage = message.message.usage;
                if (msgUsage) {
                  usage.inputTokens += msgUsage.input_tokens ?? 0;
                  usage.outputTokens += msgUsage.output_tokens ?? 0;
                  usage.cacheReadTokens += msgUsage.cache_read_input_tokens ??
                    0;
                  usage.cacheCreationTokens +=
                    msgUsage.cache_creation_input_tokens ?? 0;
                }
              }

              if (message.type === "stream_event") {
                const event = message.event;

                // Content block start - track tool use
                if (event.type === "content_block_start") {
                  const block = event.content_block;
                  if (block.type === "tool_use") {
                    currentToolId = block.id;
                    const toolMsg: ChatMessage = {
                      type: "tool_start",
                      id: block.id,
                      name: block.name,
                    };
                    write(JSON.stringify(toolMsg) + "\n");
                  }
                }

                // Content block delta - text or tool input
                if (event.type === "content_block_delta") {
                  const delta = event.delta;
                  if (delta.type === "text_delta") {
                    const textMsg: ChatMessage = {
                      type: "text",
                      delta: delta.text,
                    };
                    write(JSON.stringify(textMsg) + "\n");
                  } else if (delta.type === "thinking_delta") {
                    const thinkMsg: ChatMessage = {
                      type: "thinking",
                      delta: delta.thinking,
                    };
                    write(JSON.stringify(thinkMsg) + "\n");
                  } else if (
                    delta.type === "input_json_delta" && currentToolId
                  ) {
                    const inputMsg: ChatMessage = {
                      type: "tool_input",
                      id: currentToolId,
                      delta: delta.partial_json,
                    };
                    write(JSON.stringify(inputMsg) + "\n");
                  }
                }

                // Content block stop - end tool use
                if (event.type === "content_block_stop" && currentToolId) {
                  const endMsg: ChatMessage = {
                    type: "tool_end",
                    id: currentToolId,
                  };
                  write(JSON.stringify(endMsg) + "\n");
                  currentToolId = undefined;
                }
              }
            }
          },
        });

        await waitUntilComplete();

        // Check for changes and commit
        let storyCommitHash: string | undefined;
        const { stdout: status } = await execAsync(
          `git -C ${repoPath} status --porcelain`,
        );
        if (status.trim()) {
          await execAsync(`git -C ${repoPath} add -A`);
          await execAsync(
            `git -C ${repoPath} commit -m "${
              story.title.replace(/"/g, '\\"')
            }"`,
          );
          const { stdout: hash } = await execAsync(
            `git -C ${repoPath} rev-parse HEAD`,
          );
          storyCommitHash = hash.trim();
          logger.info("Committed story", {
            story: story.title,
            commitHash: storyCommitHash,
          });
        }

        // Run build check if package.json has build script
        let buildFailed = false;
        let buildError = "";
        try {
          const pkgPath = join(repoPath, "package.json");
          const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
          if (pkg.scripts?.build) {
            await execAsync(`npm run build`, {
              cwd: repoPath,
              timeout: 120000,
              env: { ...process.env, NODE_ENV: "production" },
            });
            logger.info("Build passed for story", { story: story.title });
          }
        } catch (error) {
          const err = error as {
            message?: string;
            stderr?: string;
            stdout?: string;
          };
          // Only mark as build failure if it's not missing package.json
          if (!err.message?.includes("ENOENT")) {
            buildFailed = true;
            // Capture build output for error display
            buildError = err.stderr || err.stdout || err.message ||
              "Build failed";
            buildError = buildError.slice(-500); // Keep last 500 chars
            logger.warn("Build failed for story", {
              story: story.title,
              error: err.message,
            });
            await appendChatMessage({
              type: "text",
              delta: `\n[Build failed: ${buildError.slice(0, 200)}]\n`,
            });
          }
        }

        // Handle story failure (build failed)
        if (buildFailed) {
          // Capture per-story diff for UI even on failure
          let storyDiff = "";
          if (storyCommitHash) {
            try {
              const { stdout: diff } = await execAsync(
                `git -C ${repoPath} diff HEAD~1`,
              );
              storyDiff = diff;
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
          });

          // Approval gate on failure (unless yolo mode or last story)
          const isLastStory = i === stories.length - 1;
          if (!yoloMode && !isLastStory) {
            const token = await wait.createToken({ timeout: "24h" });

            await appendChatMessage({
              type: "approval",
              id: `story-failed-${token.id}`,
              tokenId: token.id,
              publicAccessToken: token.publicAccessToken,
              question: `Uh oh, the build went boom! My cat's breath smells like cat food. Want me to try the next story?`,
              variant: "story",
              createdAt: Date.now(),
              timeoutMs: 24 * 60 * 60 * 1000,
            });

            const result = await wait.forToken<{ action: "continue" | "stop" }>(
              token,
            );

            if (!result.ok || result.output.action === "stop") {
              userStopped = true;
              await appendChatMessage({
                type: "approval_response",
                id: `story-failed-${token.id}`,
                action: "Stopped",
              });
              break;
            } else {
              await appendChatMessage({
                type: "approval_response",
                id: `story-failed-${token.id}`,
                action: "Continue",
              });
            }
          }

          continue;
        }

        completedStories++;

        // Update in-memory progress (Ralph loop pattern - no file in repo)
        progressLog.push(
          `### ${story.title}\n- ${story.acceptance.join("\n- ")}`,
        );

        // Capture per-story diff for UI
        let storyDiff = "";
        if (storyCommitHash) {
          try {
            const { stdout: diff } = await execAsync(
              `git -C ${repoPath} diff HEAD~1`,
            );
            storyDiff = diff;
          } catch {
            // No diff available
          }
        }

        // Story complete status (commit URLs only available after push)
        await appendStatus({
          type: "story_complete",
          message:
            `Completed story ${storyNum}/${totalStories}: ${story.title}`,
          story: {
            id: story.id,
            current: storyNum,
            total: totalStories,
            title: story.title,
            acceptance: story.acceptance,
            diff: storyDiff || undefined,
          },
          commitHash: storyCommitHash,
          progress: progressLog.join("\n\n"),
          usage,
        });

        // Approval gate (unless yolo mode or last story)
        const isLastStory = i === stories.length - 1;
        if (!yoloMode && !isLastStory) {
          const token = await wait.createToken({ timeout: "24h" });

          // Get current diff
          let currentDiff = "";
          try {
            const { stdout: diff } = await execAsync(
              `git -C ${repoPath} diff HEAD~1`,
            );
            currentDiff = diff;
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
              question:
                `Completed ${storyNum}/${totalStories} stories. Continue to "${
                  stories[i + 1]?.title
                }"?`,
            },
          });

          // Stream approval prompt to chat
          await appendChatMessage({
            type: "approval",
            id: `story-${token.id}`,
            tokenId: token.id,
            publicAccessToken: token.publicAccessToken,
            question: `I did it! Click Next Story to keep going, or Yolo to let me finish everything!`,
            variant: "story",
            createdAt: Date.now(),
            timeoutMs: 24 * 60 * 60 * 1000, // 24h
          });

          const result = await wait.forToken<
            { action: "continue" | "stop" | "yolo" }
          >(token);

          if (!result.ok || result.output.action === "stop") {
            userStopped = true;
            await appendChatMessage({
              type: "approval_response",
              id: `story-${token.id}`,
              action: "Cancelled",
            });
          } else if (result.output.action === "yolo") {
            await appendChatMessage({
              type: "approval_response",
              id: `story-${token.id}`,
              action: "Yolo mode enabled",
            });
            // Enable yolo mode for remaining stories
            yoloMode = true;
          } else {
            // Continue to next story
            await appendChatMessage({
              type: "approval_response",
              id: `story-${token.id}`,
              action: "Next story",
            });
          }
        }
      }

      // Final diff summary
      try {
        const { stdout: diff } = await execAsync(
          `git -C ${repoPath} log --oneline ${branchName} ^HEAD~${completedStories}`,
        );
        if (diff) {
          await appendStatus({
            type: "diff",
            message: `Commits:\n${diff}`,
            diff,
          });
        }
      } catch {
        // Git log failed
      }

      // Push if token provided and we have commits
      let branchUrl: string | null = null;
      let prUrl: string | null = null;
      let prTitle: string | null = null;
      let pushError: string | null = null;

      if (!githubToken && completedStories > 0) {
        pushError = "No GITHUB_TOKEN - changes not pushed to remote";
      } else if (githubToken && completedStories > 0) {
        const parsedUrl = parseGitHubUrl(repoUrl);
        if (parsedUrl) {
          try {
            await appendStatus({
              type: "pushing",
              message: "I'm sending my code to the cloud! It's like magic!",
            });

            // Set up authenticated remote and push
            const authUrl =
              `https://${githubToken}@github.com/${parsedUrl.owner}/${parsedUrl.repo}.git`;
            await execAsync(
              `git -C ${repoPath} remote set-url origin ${authUrl}`,
            );
            await execAsync(`git -C ${repoPath} push -u origin ${branchName}`);

            branchUrl =
              `https://github.com/${parsedUrl.owner}/${parsedUrl.repo}/tree/${branchName}`;

            // Create PR with descriptive title and body
            const completedStoryTitles = progressLog
              .map((log) => log.split("\n")[0].replace("### ", ""))
              .filter(Boolean);
            const prBody = `## Summary
${approvedPrd.description}

## Completed Stories
${completedStoryTitles.map((t) => `- ${t}`).join("\n")}

---
*Created by Ralph (Trigger.dev agent) 🍩*`;

            const prTitleDraft = prompt.length > 50
              ? prompt.slice(0, 47) + "..."
              : prompt;
            const prResult = await createPullRequest(
              parsedUrl.owner,
              parsedUrl.repo,
              branchName,
              prTitleDraft,
              prBody,
              githubToken,
            );
            prUrl = prResult?.url ?? null;
            prTitle = prResult?.title ?? prTitleDraft;

            const message = prUrl ?? branchUrl;
            await appendStatus({
              type: "pushed",
              message,
              branchUrl,
              prUrl: prUrl ?? undefined,
              prTitle: prTitle ?? undefined,
            });
          } catch (error) {
            const rawMessage = error instanceof Error
              ? error.message
              : "Unknown push error";
            logger.error("Failed to push", { error: rawMessage });

            // Parse push error and provide helpful hints
            let hint = "";
            if (
              rawMessage.includes("Permission denied") ||
              rawMessage.includes("Authentication failed")
            ) {
              hint =
                "The GITHUB_TOKEN may not have push access. Check token permissions (needs 'repo' scope).";
            } else if (rawMessage.includes("protected branch")) {
              hint =
                "The target branch is protected. Try pushing to a different branch or update branch protection rules.";
            } else if (rawMessage.includes("Could not resolve host")) {
              hint =
                "Network error. Check your internet connection and try again.";
            }

            pushError = hint
              ? `Uh oh, I couldn't push my changes... That's unpossible!\n\nPush failed: ${rawMessage}\n\nHint: ${hint}`
              : `Uh oh, I couldn't push my changes... That's unpossible!\n\nPush failed: ${rawMessage}`;
            await appendStatus({ type: "push_failed", message: pushError });
          }
        }
      }

      await appendStatus({
        type: "complete",
        message: `We did it! ${completedStories}/${stories.length} stories done - you're my best friend!`,
        usage,
      });

      // Stream completion to chat
      await appendChatMessage({
        type: "complete",
        prUrl: prUrl ?? undefined,
        prTitle: prTitle ?? undefined,
        branchUrl: branchUrl ?? undefined,
        error: pushError ?? undefined,
      });

      return {
        success: true,
        storiesCompleted: completedStories,
        branchUrl,
        prUrl,
        usage,
      };
    } finally {
      // Always cleanup temp directory
      await cleanup();
    }
  },
});
