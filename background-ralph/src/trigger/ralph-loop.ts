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
import {
  MCP_SERVERS,
  RALPH_PERSONALITY,
  DEFAULT_MAX_TURNS_PER_STORY,
  MAX_BUILD_FIX_ATTEMPTS,
} from "./config";
import { streamAgentToChat } from "./stream-helpers";
import { getErrorMessage } from "@/lib/safe-parse";

const execAsync = promisify(exec);

export type RalphLoopPayload = {
  repoUrl: string;
  prompt: string;
  yoloMode?: boolean; // Skip approval gates between stories (default: false)
  maxTurnsPerStory?: number; // Max agent turns per story (default: 5)
};

/**
 * Get git diff with fallback to empty string on error.
 * Used after commits to capture changes for UI display.
 */
async function getDiff(repoPath: string, ref = "HEAD~1"): Promise<string> {
  try {
    const { stdout } = await execAsync(`git -C ${repoPath} diff ${ref}`);
    return stdout;
  } catch {
    return "";
  }
}

/**
 * Parse git clone/push errors and provide helpful hints.
 */
function getGitErrorHint(
  message: string,
  context: "clone" | "push",
  hasToken: boolean
): string {
  if (message.includes("Authentication failed") || message.includes("could not read Username")) {
    return context === "clone"
      ? hasToken
        ? "The GITHUB_TOKEN may not have access to this repository."
        : "This may be a private repo. Set GITHUB_TOKEN env var to access private repositories."
      : "The GITHUB_TOKEN may not have push access. Check token permissions (needs 'repo' scope).";
  }
  if (message.includes("not found") || message.includes("Repository not found")) {
    return "Check that the repository URL is correct and the repo exists.";
  }
  if (message.includes("Could not resolve host")) {
    return "Network error. Check your internet connection and try again.";
  }
  if (message.includes("timed out") || message.includes("Timeout")) {
    return "Clone timed out. The repository may be very large, or there's a network issue.";
  }
  if (message.includes("Permission denied")) {
    return "The GITHUB_TOKEN may not have push access. Check token permissions (needs 'repo' scope).";
  }
  if (message.includes("protected branch")) {
    return "The target branch is protected. Try pushing to a different branch or update branch protection rules.";
  }
  return "";
}

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
      logger.warn("Dependency install failed", { error: getErrorMessage(error) });
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

CRITICAL: For documentation lookup, use these MCP tools for accurate, up-to-date docs:
- mcp__trigger__search_docs: Trigger.dev docs
- mcp__context7__resolve-library-id + mcp__context7__query-docs: Any npm library (Supabase, Stripe, Next.js, React, etc.)
  1. First resolve the library ID (e.g., "@supabase/supabase-js")
  2. Then get docs with specific topic query
Use WebSearch only as last resort: "[service] setup guide 2026"

Repo exploration:
${exploration}

User task: ${prompt}

STEP 1: Search docs for any services/SDKs mentioned (Trigger.dev, Supabase, Stripe, etc.)
STEP 2: Think through what needs to be done
STEP 3: Generate the PRD with correct, current patterns from the docs

IMPORTANT: Keep stories small and achievable:
- MAX 2-3 files per story (more files = split into multiple stories)
- Simple tasks (1-2 files): 1 story
- Medium tasks (3-6 files): 2-3 stories
- Complex tasks (7+ files): 4-10 stories
- More smaller stories is BETTER than fewer large stories
- Each story should be completable even if previous stories failed

CRITICAL: First story MUST install all dependencies with EXACT COMPATIBLE VERSIONS:
- Use MCP tools to find the correct compatible versions BEFORE generating the PRD
- ALWAYS pin versions: "npm install ai@4.0.0 @ai-sdk/openai@1.0.0" NOT "npm install ai @ai-sdk/openai"
- Version mismatch between ai and @ai-sdk/* causes LanguageModelV3 vs V2 errors - MUST use compatible versions
- Acceptance criteria MUST include the exact versioned install command
- Context field MUST include: "Install with: npm install package@version package2@version"
- files array for install story: ["package.json"]
- Later stories depend on US-001 completing the installs with correct versions

After researching docs, output ONLY valid JSON (no markdown fences, no explanation):
{
  "name": "${repoName}",
  "description": "brief description of the task",
  "stories": [
    {
      "id": "US-001",
      "title": "short title",
      "acceptance": ["criterion 1", "criterion 2"],
      "dependencies": [],
      "files": ["path/to/create.ts", "path/to/edit.tsx"],
      "context": "Research summary: exact package versions, import statements, code patterns, and warnings"
    }
  ]
}

Rules:
- Stories should be in dependency order (later stories can depend on earlier ones)
- Each story should be completable in 1-3 agent iterations
- Use sequential IDs: US-001, US-002, etc.
- Create process.env for all config values, including API keys, project IDs, secrets, and any other config values

CRITICAL - files array must use EXACT paths from repo exploration above:
- Look at the "Files:" section in the exploration to see the actual directory structure
- If exploration shows "./src/trigger/..." then use "src/trigger/newfile.ts"
- If exploration shows "./app/..." then use "app/page.tsx"
- If exploration shows "./trigger/..." (no src) then use "trigger/newfile.ts"
- NEVER guess paths - only use paths that match the actual repo structure
- For new files, place them in the correct existing directory (e.g., new trigger tasks go in src/trigger/ if that's where other tasks are)
- files: Array of EXACT file paths this story will create or modify

Acceptance criteria rules:
- Every story MUST have "Create path/file.ts" or "Edit path/file.ts" in acceptance
- Paths in acceptance MUST match the files array exactly
- Include correct import paths from docs in acceptance criteria
- Create an .env.example file with all config values

CRITICAL - context field for EVERY story:
The context field captures your research so the story agent can write correct code.
Include:
- Exact package versions (e.g., "ai@4.0.0 with @ai-sdk/openai@1.0.0 - versions must match")
- Import statements (e.g., "import { streamText } from 'ai'")
- Key code patterns from docs (e.g., "streamText({ model: openai('gpt-4o-mini'), prompt })")
- Version compatibility warnings (e.g., "older @ai-sdk/openai returns LanguageModelV2, need v1.0.0+ for V3")
Make context complete enough that the story agent can write working code on first try.`;

  // Use Agent SDK with WebSearch to research docs before generating PRD
  const agentResult = query({
    prompt: prdPrompt,
    options: {
      model: "claude-opus-4-5",
      maxTurns: 25, // More turns for Context7 lookups (2 per library) + PRD generation
      permissionMode: "acceptEdits",
      mcpServers: MCP_SERVERS,
      allowedTools: [
            "WebSearch",
            "mcp__trigger__search_docs",
            "mcp__context7__resolve-library-id",
            "mcp__context7__query-docs",
          ],
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

    if (message.type === "result") {
      if (message.subtype === "success") {
        finalResult = message.result;
      } else {
        // Log error result types
        logger.warn("Agent result error", { subtype: message.subtype });
        throw new Error(`PRD generation failed: ${message.subtype}`);
      }
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

    // Log full PRD for debugging
    const prdDebug = {
      name: prd.name,
      description: prd.description,
      storyCount: prd.stories.length,
      stories: prd.stories.map((s) => ({
        id: s.id,
        title: s.title,
        files: s.files,
        acceptance: s.acceptance,
        context: s.context || "NO CONTEXT",
      })),
    };
    logger.info("PRD generated", prdDebug);

    // Also stream PRD to chat for visibility
    streamWrite(JSON.stringify({
      type: "text",
      delta: `\n\n📋 PRD DEBUG:\n${JSON.stringify(prdDebug, null, 2)}\n\n`,
    }) + "\n");

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
    logger.error("PR creation error", { error: getErrorMessage(error) });
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
      const rawMessage = getErrorMessage(error);
      const hint = getGitErrorHint(rawMessage, "clone", !!githubToken);

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

      // Create branch from shortened prompt + timestamp for uniqueness
      const promptSlug = prompt
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 35);
      const timestamp = Date.now().toString(36).slice(-4); // short unique suffix
      const branchName = `ralph/${promptSlug}-${timestamp}`;
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

        // Log story execution start with context
        logger.info("Starting story execution", {
          storyId: story.id,
          title: story.title,
          files: story.files,
          context: story.context || "NO CONTEXT",
        });

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

        const storyFiles = story.files || [];
        const storyContext = story.context
          ? `\n\nRESEARCH CONTEXT (from PRD planning):\n${story.context}`
          : "";

        const storyPrompt =
          `${RALPH_PERSONALITY}

You are working in a cloned git repository at: ${repoPath}
All file paths should be relative to this directory (e.g., "README.md" not "/README.md").

Overall task: ${prompt}
${progressContext}

Current story (${storyNum}/${totalStories}): ${story.title}

FILES YOU MUST CREATE OR MODIFY (validation will fail if any are missing):
${storyFiles.map((f) => `- ${f}`).join("\n")}

Acceptance criteria:
${story.acceptance.map((c, i) => `${i + 1}. ${c}`).join("\n")}
${storyContext}

BEFORE WRITING CODE - Verify patterns with MCP tools:
- mcp__trigger__search_docs for Trigger.dev patterns
- mcp__context7__resolve-library-id + mcp__context7__query-docs for npm packages
The research context above is a head start, but MCP tools are the source of truth.

Guidelines:
- Use process.env for ALL config values (API keys, project IDs, secrets)
- NEVER create .env files directly - only create .env.example with placeholder values
- Next.js 14+: App Router is default, do NOT use experimental.appDir

CRITICAL: You MUST create/modify ALL files listed above. This is non-negotiable.
- Use Write tool to create new files
- Use Edit tool to modify existing files
- Do NOT just research or plan - actually write the code
- Story FAILS if ANY file in the list above is not in your commit

Complete this story by creating/editing ALL ${storyFiles.length} files listed above.`;

        const agentResult = query({
          prompt: storyPrompt,
          options: {
            model: "claude-opus-4-5",
            abortController,
            cwd: repoPath,
            maxTurns: maxTurnsPerStory,
            permissionMode: "acceptEdits",
            mcpServers: MCP_SERVERS,
            includePartialMessages: true,
            allowedTools: [
              "Read",
              "Edit",
              "Write",
              "Bash",
              "Grep",
              "Glob",
              "mcp__trigger__search_docs",
              "mcp__context7__resolve-library-id",
              "mcp__context7__query-docs",
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
        const commitChanges = async (): Promise<boolean> => {
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
            return true;
          }
          return false;
        };
        const hasChanges = await commitChanges();

        // Fail if no files were created/modified - agent didn't do the work
        let buildFailed = false;
        let buildError = "";

        if (!hasChanges) {
          buildFailed = true;
          buildError = "Story completed but no files were created or modified. The agent may have run out of turns or failed to write files.";
          logger.warn("No file changes for story", { story: story.title });
        }

        // Check that expected files from story.files were actually created/modified
        if (!buildFailed && storyCommitHash) {
          const expectedFiles = story.files || [];
          if (expectedFiles.length > 0) {
            // Get list of files changed in this commit
            let changedFiles: string[] = [];
            try {
              const { stdout } = await execAsync(
                `git -C ${repoPath} diff --name-only HEAD~1 HEAD`,
              );
              changedFiles = stdout.trim().split("\n").filter(Boolean);
            } catch {
              // If diff fails (e.g., first commit), skip this validation
              changedFiles = [];
            }

            // Only validate if we got the changed files list
            if (changedFiles.length > 0) {
              const untouchedFiles: string[] = [];
              for (const file of expectedFiles) {
                // Flexible matching: compare basenames or check if paths overlap
                // Handles cases like "trigger/foo.ts" matching "src/trigger/foo.ts"
                const basename = file.split("/").pop() || file;
                const wasChanged = changedFiles.some((f) => {
                  const changedBasename = f.split("/").pop() || f;
                  // Exact match, or basename match with same parent dirs
                  return f === file ||
                    f.endsWith(`/${file}`) ||
                    file.endsWith(`/${f}`) ||
                    (basename === changedBasename && (f.includes(file.replace(basename, "")) || file.includes(f.replace(changedBasename, ""))));
                });
                if (!wasChanged) {
                  untouchedFiles.push(file);
                }
              }
              if (untouchedFiles.length > 0) {
                buildFailed = true;
                buildError = `Story files weren't touched: ${untouchedFiles.join(", ")}. Changed: ${changedFiles.join(", ")}`;
                logger.warn("Expected files not in commit", { story: story.title, untouchedFiles, changedFiles });
              }
            }
          }
        }

        // Run build check with retry loop - agent gets chance to fix errors
        // Skip if already failed (e.g., no file changes)
        for (let buildAttempt = 0; !buildFailed && buildAttempt <= MAX_BUILD_FIX_ATTEMPTS; buildAttempt++) {
          try {
            const pkgPath = join(repoPath, "package.json");
            const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
            if (pkg.scripts?.build) {
              await execAsync(`npm run build`, {
                cwd: repoPath,
                timeout: 120000,
                env: { ...process.env, NODE_ENV: "production" },
              });
              logger.info("Build passed for story", { story: story.title, attempt: buildAttempt });
              break; // Build passed, exit retry loop
            } else {
              break; // No build script, nothing to check
            }
          } catch (error) {
            const errorMsg = getErrorMessage(error);
            const errObj = error as { stderr?: string; stdout?: string };
            // Only mark as build failure if it's not missing package.json
            if (errorMsg.includes("ENOENT")) {
              break; // No package.json, skip build check
            }

            buildFailed = true;
            buildError = errObj.stderr || errObj.stdout || errorMsg;
            buildError = buildError.slice(-1000); // Keep last 1000 chars for context
            logger.warn("Build failed for story", {
              story: story.title,
              attempt: buildAttempt,
              error: errorMsg,
            });

            // If we have retries left, let agent fix the error
            if (buildAttempt < MAX_BUILD_FIX_ATTEMPTS) {
              await appendChatMessage({
                type: "text",
                delta: `\n\n🔴 BUILD FAILED (Story: ${story.title}, attempt ${buildAttempt + 1}/${MAX_BUILD_FIX_ATTEMPTS + 1}):\n\`\`\`\n${buildError.slice(0, 800)}\n\`\`\`\n\nLet me fix that...\n`,
              });

              // Run agent again with fix prompt
              const storyContextForFix = story.context
                ? `\nOriginal research context:\n${story.context}\n`
                : "";

              const fixPrompt = `The build failed with this error:

\`\`\`
${buildError}
\`\`\`
${storyContextForFix}
REQUIRED: Use MCP tools to look up the CURRENT correct patterns:
- mcp__trigger__search_docs for Trigger.dev
- mcp__context7__resolve-library-id + mcp__context7__query-docs for npm packages

Do NOT guess. Look up the docs, find the correct pattern, then fix the code.
Read the relevant files, understand the issue, and make the fix.`;

              const fixResult = query({
                prompt: fixPrompt,
                options: {
                  model: "claude-opus-4-5",
                  abortController,
                  cwd: repoPath,
                  maxTurns: 10, // Enough to: read error, lookup docs, understand fix, apply it
                  permissionMode: "acceptEdits",
                  mcpServers: MCP_SERVERS,
                  includePartialMessages: true,
                  allowedTools: [
                  "Read",
                  "Edit",
                  "Write",
                  "Bash",
                  "Grep",
                  "Glob",
                  "mcp__trigger__search_docs",
                  "mcp__context7__resolve-library-id",
                  "mcp__context7__query-docs",
                ],
                },
              });

              // Stream fix agent output and track result
              let fixSucceeded = false;
              const { waitUntilComplete: waitForFix } = agentOutputStream.writer({
                execute: async ({ write }) => {
                  for await (const message of fixResult) {
                    if (message.type === "stream_event") {
                      const event = message.event;
                      if (event.type === "content_block_delta") {
                        const delta = event.delta;
                        if (delta.type === "text_delta") {
                          write(JSON.stringify({ type: "text", delta: delta.text } as ChatMessage) + "\n");
                        } else if (delta.type === "thinking_delta") {
                          write(JSON.stringify({ type: "thinking", delta: delta.thinking } as ChatMessage) + "\n");
                        }
                      }
                    }
                    if (message.type === "result") {
                      fixSucceeded = message.subtype === "success";
                      logger.info("Fix agent result", { subtype: message.subtype, success: fixSucceeded });
                    }
                  }
                },
              });

              await waitForFix();

              if (!fixSucceeded) {
                logger.warn("Fix agent did not succeed, continuing anyway");
              }

              // Commit the fix
              await commitChanges();

              // Reset buildFailed so the loop tries the build again
              buildFailed = false;
            } else {
              // Out of retries, show final error
              await appendChatMessage({
                type: "text",
                delta: `\n\n❌ BUILD FAILED PERMANENTLY (Story: ${story.title}) after ${MAX_BUILD_FIX_ATTEMPTS + 1} attempts:\n\`\`\`\n${buildError.slice(0, 800)}\n\`\`\`\n`,
              });
            }
          }
        }

        // Handle story failure (build failed)
        if (buildFailed) {
          // Capture per-story diff for UI even on failure
          const storyDiff = storyCommitHash ? await getDiff(repoPath) : "";

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

          // Build failed after all retries - STOP, don't continue to broken code
          // In yolo mode, still stop (can't push broken builds)
          // In non-yolo mode, ask user what to do
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
              continue; // User chose to continue despite failure
            }
          }

          // In yolo mode or last story: stop on build failure (can't ship broken code)
          userStopped = true;
          break;
        }

        completedStories++;

        // Update in-memory progress (Ralph loop pattern - no file in repo)
        progressLog.push(
          `### ${story.title}\n- ${story.acceptance.join("\n- ")}`,
        );

        // Capture per-story diff for UI
        const storyDiff = storyCommitHash ? await getDiff(repoPath) : "";

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
          const currentDiff = await getDiff(repoPath);

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
            const rawMessage = getErrorMessage(error);
            logger.error("Failed to push", { error: rawMessage });

            const hint = getGitErrorHint(rawMessage, "push", true);
            pushError = hint
              ? `Uh oh, I couldn't push my changes... That's unpossible!\n\nPush failed: ${rawMessage}\n\nHint: ${hint}`
              : `Uh oh, I couldn't push my changes... That's unpossible!\n\nPush failed: ${rawMessage}`;
            await appendStatus({ type: "push_failed", message: pushError });
          }
        }
      }

      // Determine completion message and error
      const noStoriesCompleted = completedStories === 0;
      const completionError = noStoriesCompleted
        ? `All ${stories.length} stories failed their builds. Check the errors above - the agent couldn't fix them automatically.`
        : pushError ?? undefined;

      const someStoriesFailed = completedStories > 0 && completedStories < stories.length;

      await appendStatus({
        type: "complete",
        message: noStoriesCompleted
          ? `Uh oh... none of the stories passed their builds. My cat's breath smells like cat food.`
          : someStoriesFailed
          ? `Partial success: ${completedStories}/${stories.length} stories done. Some stories failed - check errors above.`
          : `We did it! ${completedStories}/${stories.length} stories done - you're my best friend!`,
        usage,
      });

      // Stream completion to chat
      await appendChatMessage({
        type: "complete",
        prUrl: prUrl ?? undefined,
        prTitle: prTitle ?? undefined,
        branchUrl: branchUrl ?? undefined,
        error: completionError,
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
