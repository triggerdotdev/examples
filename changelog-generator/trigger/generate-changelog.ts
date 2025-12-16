import {
  createSdkMcpServer,
  query,
  tool,
} from "@anthropic-ai/claude-agent-sdk";
import { metadata, schemaTask } from "@trigger.dev/sdk";
import { Octokit } from "octokit";
import { z } from "zod";
import { changelogStream } from "./changelog-stream";

const generateChangelogSchema = z.object({
  repoUrl: z.string().url(),
  startDate: z.string(),
  endDate: z.string(),
});

// Create GitHub tools for Claude to use
function createGitHubTools(owner: string, repo: string) {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  return createSdkMcpServer({
    name: "github",
    version: "1.0.0",
    tools: [
      tool(
        "list_commits",
        "List commits in the repository within a date range. Returns commit SHA, message, author, and date. Use this first to see all commits, then use get_commit_diff for commits that need deeper investigation.",
        {
          since: z.string().describe("ISO date string for start of range"),
          until: z.string().describe("ISO date string for end of range"),
        },
        async (args) => {
          const commits: string[] = [];
          let page = 1;
          const perPage = 100;

          while (true) {
            const response = await octokit.rest.repos.listCommits({
              owner,
              repo,
              since: args.since,
              until: args.until,
              per_page: perPage,
              page,
            });

            if (response.data.length === 0) break;

            for (const commit of response.data) {
              const sha = commit.sha.substring(0, 7);
              const date = commit.commit.author?.date?.split("T")[0] || "";
              const author = commit.commit.author?.name || "Unknown";
              const message = commit.commit.message.split("\n")[0];
              commits.push(`[${sha}] ${date} (${author}): ${message}`);
            }

            if (response.data.length < perPage) break;
            page++;
            if (commits.length >= 300) break;
          }

          metadata.set("commitCount", commits.length);

          return {
            content: [
              {
                type: "text" as const,
                text: commits.length > 0
                  ? `Found ${commits.length} commits:\n\n${commits.join("\n")}`
                  : "No commits found in this date range.",
              },
            ],
          };
        },
      ),

      tool(
        "get_commit_diff",
        "Get the full diff/patch for a specific commit. Use this to understand what code actually changed when the commit message is unclear or you need more context.",
        {
          sha: z
            .string()
            .describe("The commit SHA (short or full) to get diff for"),
        },
        async (args) => {
          try {
            const response = await octokit.rest.repos.getCommit({
              owner,
              repo,
              ref: args.sha,
            });

            const commit = response.data;
            const files = commit.files || [];

            let diffOutput = `Commit: ${commit.sha.substring(0, 7)}\n`;
            diffOutput += `Author: ${commit.commit.author?.name}\n`;
            diffOutput += `Date: ${commit.commit.author?.date}\n`;
            diffOutput += `Message: ${commit.commit.message}\n\n`;
            diffOutput += `Files changed: ${files.length}\n`;
            diffOutput += `Additions: ${
              commit.stats?.additions || 0
            }, Deletions: ${commit.stats?.deletions || 0}\n\n`;

            for (const file of files) {
              diffOutput += `--- ${file.filename} (${file.status}) ---\n`;
              if (file.patch) {
                // Truncate very large patches
                const patch = file.patch.length > 2000
                  ? file.patch.substring(0, 2000) + "\n... (truncated)"
                  : file.patch;
                diffOutput += patch + "\n\n";
              }
            }

            return {
              content: [{ type: "text" as const, text: diffOutput }],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Error fetching commit ${args.sha}: ${
                    error instanceof Error ? error.message : "Unknown error"
                  }`,
                },
              ],
            };
          }
        },
      ),
    ],
  });
}

export const generateChangelog = schemaTask({
  id: "generate-changelog",
  schema: generateChangelogSchema,
  maxDuration: 300, // 5 minutes for agent exploration
  run: async ({ repoUrl, startDate, endDate }, { signal }) => {
    const abortController = new AbortController();
    signal.addEventListener("abort", () => abortController.abort());

    metadata.set("status", "Starting...");
    metadata.set("progress", 10);

    // Parse repo URL
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      throw new Error("Invalid GitHub repository URL");
    }
    const [, owner, repo] = match;
    const repoName = `${owner}/${repo.replace(".git", "")}`;
    metadata.set("repository", repoName);

    // Create GitHub tools for this repo
    const githubServer = createGitHubTools(owner, repo.replace(".git", ""));

    metadata.set("status", "Analyzing commits...");
    metadata.set("progress", 20);

    const promptContent =
      `You are a changelog writer analyzing the ${repoName} repository.

Your task is to generate a developer-friendly changelog for commits between ${
        startDate.split("T")[0]
      } and ${endDate.split("T")[0]}.

WORKFLOW:
1. First, use list_commits to see all commits in the date range
2. Categorize commits:
   - SKIP trivial commits entirely (typo fixes, "fix bug", formatting, minor fixes) - don't investigate or include these
   - INCLUDE clear feature/improvement commits directly in changelog
   - INVESTIGATE ONLY commits that look potentially significant but have unclear messages (e.g., "update auth" or "refactor payments")
3. Use get_commit_diff sparingly - only for significant commits where the message doesn't tell you enough
4. Write the changelog focusing on user-facing changes

CHANGELOG FORMAT (MDX):
- Use ## headings for categories (Features, Improvements, Breaking Changes, Bug Fixes)
- Each feature/change gets its OWN entry - do NOT group multiple features together
- Write entries in chronological order: NEWEST FIRST (most recent date at top)
- Write technical content, no fluff
- Breaking changes go at the top with migration steps
- Include the date at the END of the entry in format: [DATE: Dec 7]
- Do NOT include commit SHAs

WHAT TO INCLUDE - ask "does this change or improve the developer experience?":
- New capabilities (things they couldn't do before)
- Performance/reliability improvements (faster, more stable)
- DX improvements (better errors, easier setup)
- Breaking changes (things they need to update)

SKIP: Internal refactors, code cleanup, tests, CI, dependencies - anything with no visible impact

For every included entry, write thorough documentation with sections and code examples. Err on the side of including more detail.

Structure entries with sections like:
- What's new (the change)
- How to use it (with code examples for different scenarios)
- Under the hood (technical details if interesting)
- Why this matters (benefits)
- Requirements (if any)

Example HIGH importance entry:
## Features

### Native build server for deployments

Deploy your tasks using our own build infrastructure instead of third-party providers.

#### What's new
Native builds use our own build server infrastructure. Deployments work the same as before, just more reliably.

#### Using native builds with the CLI
Deploy with native builds using the --native-build-server flag:

\`\`\`bash
npx trigger.dev deploy --native-build-server
\`\`\`

Build logs stream directly to the dashboard in real-time.

If you prefer to trigger a deployment without waiting:

\`\`\`bash
npx trigger.dev deploy --native-build-server --detach
\`\`\`

#### Under the hood
1. The CLI packages your deployment files into an archive
2. Archive uploads to our infrastructure via pre-signed S3 URL
3. Our build server downloads and builds the container image
4. Build logs stream back to CLI and dashboard in real-time

#### Why this matters
- **Reliability**: Removes dependency on external build providers
- **Control**: Allows us to optimize the build process
- **Performance**: Opens the door for future build optimizations

#### Requirements
Requires version 4.2.0 or later:

\`\`\`bash
npx trigger.dev update
\`\`\`

[DATE: Dec 12]

Output ONLY the final changelog, no explanations or preamble.`;

    // Async generator required for MCP servers
    async function* promptGenerator(): AsyncGenerator<{
      type: "user";
      message: { role: "user"; content: string };
      parent_tool_use_id: null;
      session_id: string;
    }> {
      yield {
        type: "user",
        message: { role: "user", content: promptContent },
        parent_tool_use_id: null,
        session_id: "changelog-session",
      };
    }

    // Run the agent
    const result = query({
      prompt: promptGenerator(),
      options: {
        model: "claude-sonnet-4-20250514",
        maxTurns: 20,
        abortController,
        includePartialMessages: true,
        mcpServers: {
          github: githubServer,
        },
        allowedTools: [
          "mcp__github__list_commits",
          "mcp__github__get_commit_diff",
        ],
      },
    });

    const startTime = Date.now();

    // Initialize structured agent state
    metadata.set("agent", {
      phase: "exploring",
      turns: 0,
      toolCalls: [],
      diffsInvestigated: [],
      startedAt: new Date().toISOString(),
    });
    metadata.set("status", "Agent exploring commits...");
    metadata.set("progress", 40);

    // Local state for tracking
    const toolCalls: Array<{
      tool: string;
      input: string;
      timestamp: string;
    }> = [];
    let turnCount = 0;
    const diffsInvestigated: string[] = [];

    // Stream the response
    const { waitUntilComplete } = changelogStream.writer({
      execute: async ({ write }) => {
        for await (const message of result) {
          // Track turns
          if (message.type === "assistant") {
            turnCount++;
            metadata.set("agent", {
              phase: "exploring",
              turns: turnCount,
              toolCalls: [...toolCalls],
              diffsInvestigated: [...diffsInvestigated],
              startedAt: new Date(startTime).toISOString(),
            });
          }

          // Log tool calls with details
          if (message.type === "assistant" && message.message?.content) {
            for (const block of message.message.content) {
              if (block.type === "tool_use") {
                const toolCall = {
                  tool: block.name.replace("mcp__github__", ""),
                  input: JSON.stringify(block.input),
                  timestamp: new Date().toISOString(),
                };
                toolCalls.push(toolCall);

                if (block.name === "mcp__github__list_commits") {
                  metadata.set("status", "Fetching commit list...");
                  metadata.set("agent", {
                    phase: "fetching_commits",
                    turns: turnCount,
                    toolCalls: [...toolCalls],
                    diffsInvestigated: [...diffsInvestigated],
                    startedAt: new Date(startTime).toISOString(),
                  });
                } else if (block.name === "mcp__github__get_commit_diff") {
                  const sha = (block.input as { sha?: string })?.sha || "unknown";
                  diffsInvestigated.push(sha);
                  metadata.set(
                    "status",
                    `Investigating commit ${sha} (${diffsInvestigated.length} checked)`,
                  );
                  metadata.set("agent", {
                    phase: "investigating_diffs",
                    turns: turnCount,
                    toolCalls: [...toolCalls],
                    diffsInvestigated: [...diffsInvestigated],
                    currentDiff: sha,
                    startedAt: new Date(startTime).toISOString(),
                  });
                }
              }
            }
          }

          // Stream text deltas
          if (message.type === "stream_event") {
            const event = message.event;
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              metadata.set("status", "Writing changelog...");
              metadata.set("progress", 80);
              metadata.set("agent", {
                phase: "writing",
                turns: turnCount,
                toolCalls: [...toolCalls],
                diffsInvestigated: [...diffsInvestigated],
                startedAt: new Date(startTime).toISOString(),
              });
              write(event.delta.text);
            }
          }
        }
      },
    });

    await waitUntilComplete();

    const duration = Date.now() - startTime;

    // Final summary
    metadata.set("status", "Completed");
    metadata.set("progress", 100);
    metadata.set("agent", {
      phase: "completed",
      turns: turnCount,
      toolCalls: [...toolCalls],
      diffsInvestigated: [...diffsInvestigated],
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: duration,
    });
    metadata.set("summary", {
      diffsChecked: diffsInvestigated.length,
      agentTurns: turnCount,
      durationSec: Math.round(duration / 1000),
    });

    return {
      repoName,
      startDate,
      endDate,
      status: "completed",
    };
  },
});
