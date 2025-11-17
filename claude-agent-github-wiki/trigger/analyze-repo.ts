import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { schemaTask, streams } from "@trigger.dev/sdk";
import { z } from "zod";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// REALTIME STREAMS V2: Define typed stream for all agent messages
// This stream will carry every SDKMessage from the Claude Agent (text, tool_use, tool_result)
export const agentStream = streams.define<SDKMessage>({
  id: "agent-messages",
});

export const analyzeRepo = schemaTask({
  id: "analyze-repo",
  // Define input schema: GitHub URL and user query
  schema: z.object({
    githubUrl: z.string().url(),
    query: z.string().min(1),
  }),
  run: async ({ githubUrl, query }, { signal }) => {
    // AbortController to cancel Claude agent if task is aborted
    const abortController = new AbortController();

    // Forward cancellation from Trigger.dev to Claude Agent
    signal.addEventListener("abort", () => {
      abortController.abort();
    });

    // 1. Create temp directory for repo clone
    const tempDir = await mkdtemp(join(tmpdir(), "repo-"));
    console.log(`Created temp directory: ${tempDir}`);

    try {
      // 2. Extract repo name from URL for logging
      const repoName = githubUrl.split("/").slice(-2).join("/").replace(
        ".git",
        "",
      );
      console.log(`Cloning repository: ${repoName}`);

      // 3. Shallow clone repo (depth=1, single branch)
      // This minimizes transfer time and disk usage
      const cloneCmd =
        `git clone --depth=1 --single-branch "${githubUrl}" "${tempDir}/repo"`;

      try {
        await execAsync(cloneCmd, {
          timeout: 120000, // 2 minute timeout for clone
          signal: abortController.signal,
        });
        console.log(`Successfully cloned ${repoName}`);
      } catch (cloneError: any) {
        // Handle clone failures (private repos, 404s, network errors)
        if (
          cloneError.code === 128 || cloneError.stderr?.includes("not found")
        ) {
          throw new Error(
            `Failed to clone repository. It may be private, not exist, or the URL is invalid.`,
          );
        }
        throw new Error(`Clone failed: ${cloneError.message}`);
      }

      // 4. Initialize Claude Agent query with streaming
      // The agent will have access to all necessary tools to explore the codebase
      console.log(`Starting Claude agent query: "${query}"`);

      const result = query({
        prompt: query,
        options: {
          model: "claude-sonnet-4-20250514",
          maxThinkingTokens: 8192,
          abortController,
          cwd: join(tempDir, "repo"), // Set working directory to cloned repo
          maxTurns: 10, // Allow multiple rounds of tool usage
          permissionMode: "acceptEdits", // Allow file edits if needed
          // Enable tools for code exploration
          allowedTools: [
            "Task", // For complex multi-step operations
            "Bash", // For running commands
            "Glob", // For finding files by pattern
            "Grep", // For searching file contents
            "Read", // For reading files
            "Edit", // For editing files (if user asks)
            "Write", // For writing new files (if user asks)
          ],
        },
      });

      // 5. REALTIME STREAMS V2: Pipe every message from Claude to the stream
      // The pipe() method returns a write function for sending data to the stream
      const { write } = agentStream.pipe();

      // 6. Stream all messages in real-time to the frontend
      // Each iteration yields a message: text responses, tool calls, tool results, etc.
      for await (const message of result) {
        write(message); // Send to Realtime Stream for immediate frontend display

        // Log message types for debugging
        console.log(`Streamed message type: ${message.type}`);
      }

      console.log(`Query completed successfully`);
      return { success: true, repoName };
    } catch (error: any) {
      console.error(`Task failed:`, error);

      // Stream error message to frontend
      const { write } = agentStream.pipe();
      write({
        type: "text",
        text: `Error: ${error.message || "An unexpected error occurred"}`,
      } as SDKMessage);

      throw error;
    } finally {
      // 7. Always cleanup temp directory (success or failure)
      // TODO: Future enhancement - implement repo caching with Redis/KV to avoid re-cloning
      console.log(`Cleaning up temp directory: ${tempDir}`);
      try {
        await rm(tempDir, { recursive: true, force: true });
        console.log(`Successfully cleaned up temp directory`);
      } catch (cleanupError) {
        console.error(`Failed to cleanup temp directory:`, cleanupError);
      }
    }
  },
});
