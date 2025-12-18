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

function createGitHubTools(owner: string, repo: string) {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

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

          while (commits.length < 300) {
            const { data } = await octokit.rest.repos.listCommits({
              owner,
              repo,
              since: args.since,
              until: args.until,
              per_page: 100,
              page,
            });

            if (data.length === 0) break;

            for (const commit of data) {
              const sha = commit.sha.substring(0, 7);
              const date = commit.commit.author?.date?.split("T")[0] || "";
              const author = commit.commit.author?.name || "Unknown";
              const message = commit.commit.message.split("\n")[0];
              commits.push(`[${sha}] ${date} (${author}): ${message}`);
            }

            if (data.length < 100) break;
            page++;
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
          sha: z.string().describe("The commit SHA (short or full)"),
        },
        async (args) => {
          try {
            const { data: commit } = await octokit.rest.repos.getCommit({
              owner,
              repo,
              ref: args.sha,
            });

            const files = commit.files || [];
            const lines = [
              `Commit: ${commit.sha.substring(0, 7)}`,
              `Author: ${commit.commit.author?.name}`,
              `Date: ${commit.commit.author?.date}`,
              `Message: ${commit.commit.message}`,
              "",
              `Files changed: ${files.length}`,
              `+${commit.stats?.additions || 0} -${
                commit.stats?.deletions || 0
              }`,
              "",
            ];

            for (const file of files) {
              lines.push(`--- ${file.filename} (${file.status}) ---`);
              if (file.patch) {
                const patch = file.patch.length > 2000
                  ? file.patch.substring(0, 2000) + "\n... (truncated)"
                  : file.patch;
                lines.push(patch, "");
              }
            }

            return {
              content: [{ type: "text" as const, text: lines.join("\n") }],
            };
          } catch (error) {
            const msg = error instanceof Error
              ? error.message
              : "Unknown error";
            return {
              content: [{ type: "text" as const, text: `Error: ${msg}` }],
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
  maxDuration: 300,
  run: async ({ repoUrl, startDate, endDate }, { signal }) => {
    const abortController = new AbortController();
    signal.addEventListener("abort", () => abortController.abort());

    // Parse repo URL
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) throw new Error("Invalid GitHub repository URL");

    const [, owner, repo] = match;
    const repoName = `${owner}/${repo.replace(".git", "")}`;
    metadata.set("repository", repoName);

    const githubServer = createGitHubTools(owner, repo.replace(".git", ""));

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
    const toolCalls: { tool: string; input: string }[] = [];
    const diffsInvestigated: string[] = [];
    let turns = 0;

    const updateAgent = (phase: string) => {
      metadata.set("agent", { phase, turns, toolCalls, diffsInvestigated });
    };

    updateAgent("exploring");

    const { waitUntilComplete } = changelogStream.writer({
      execute: async ({ write }) => {
        for await (const message of result) {
          if (message.type === "assistant") {
            turns++;
            updateAgent("exploring");
          }

          if (message.type === "assistant" && message.message?.content) {
            for (const block of message.message.content) {
              if (block.type === "tool_use") {
                const tool = block.name.replace("mcp__github__", "");
                const input = JSON.stringify(block.input);
                toolCalls.push({ tool, input });

                if (tool === "list_commits") {
                  updateAgent("fetching_commits");
                } else if (tool === "get_commit_diff") {
                  const sha = (block.input as { sha?: string })?.sha ||
                    "unknown";
                  diffsInvestigated.push(sha);
                  updateAgent("investigating_diffs");
                }
              }
            }
          }

          if (message.type === "stream_event") {
            const event = message.event;
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              updateAgent("writing");
              write(event.delta.text);
            }
          }
        }
      },
    });

    await waitUntilComplete();

    updateAgent("completed");
    metadata.set("summary", {
      durationSec: Math.round((Date.now() - startTime) / 1000),
    });

    return { repoName, startDate, endDate };
  },
});
