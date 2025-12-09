import { query } from "@anthropic-ai/claude-agent-sdk";
import { metadata, schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { agentStream } from "./agent-stream";

const execAsync = promisify(exec);

// Schema for the task payload
const analyzeRepoSchema = z.object({
  repoUrl: z.string().url(),
  question: z.string().min(1),
});

export const analyzeRepo = schemaTask({
  id: "analyze-repo",
  schema: analyzeRepoSchema,
  maxDuration: 600, // 10 minutes max
  run: async ({ repoUrl, question }, { signal }) => {
    const abortController = new AbortController();

    signal.addEventListener("abort", () => {
      abortController.abort();
    });

    // Update progress metadata
    metadata.set("status", "Starting analysis...");
    metadata.set("progress", 10);

    // Validate GitHub URL
    if (!repoUrl.includes("github.com")) {
      throw new Error("Please provide a valid GitHub repository URL");
    }

    // Extract repo info
    const repoName = repoUrl.split("/").slice(-2).join("/").replace(".git", "");
    metadata.set("repository", repoName);

    // Create temp directory for repo clone
    metadata.set("status", "Creating temporary directory...");
    metadata.set("progress", 20);
    const tempDir = await mkdtemp(join(tmpdir(), "repo-"));
    console.log(`Created temp directory: ${tempDir}`);

    try {
      // Clone repository
      metadata.set("status", "Cloning repository...");
      metadata.set("progress", 30);
      console.log(`Cloning repository: ${repoName}`);

      // Shallow clone repo (depth=1, single branch)
      const cloneCmd =
        `git clone --depth=1 --single-branch "${repoUrl}" "${tempDir}/repo"`;

      try {
        await execAsync(cloneCmd, {
          timeout: 120000, // 2 minute timeout for clone
          signal: abortController.signal,
        });
        console.log(`Successfully cloned ${repoName}`);
      } catch (cloneError: any) {
        // Cleanup temp dir on clone failure
        await rm(tempDir, { recursive: true, force: true });

        if (
          cloneError.code === 128 || cloneError.stderr?.includes("not found")
        ) {
          throw new Error(
            `Failed to clone repository. It may be private, not exist, or the URL is invalid.`,
          );
        }
        throw new Error(`Clone failed: ${cloneError.message}`);
      }

      metadata.set("status", "Analyzing codebase...");
      metadata.set("progress", 50);

      // Get repository size for warning
      const { stdout: sizeOutput } = await execAsync(
        `du -sh "${tempDir}/repo" | cut -f1`,
        { signal: abortController.signal },
      );
      metadata.set("repoSize", sizeOutput.trim());

      // Prepare the prompt for Claude
      const systemPrompt =
        `You are analyzing the ${repoName} repository that has been cloned to your current working directory.

Your task is to answer the user's question about this repository. Use the available tools (Bash, Read, Grep, Glob) to explore the codebase as needed, but DO NOT narrate your exploration process. The user cannot see your tool usage.

After exploring the repository, provide:
1. A brief 2-3 sentence overview of what this repository contains and its main purpose
2. A detailed answer to the user's specific question

User's question: ${question}

Important: Only include your final analysis in your response. Do not include phrases like "Let me explore", "Let me check", "Now let me examine", etc. The user only wants to see the final answer.`;

      // Use Claude Agent SDK to analyze the repository
      const result = query({
        prompt: systemPrompt,
        options: {
          model: "claude-sonnet-4-20250514",
          cwd: join(tempDir, "repo"),
          maxTurns: 30,
          permissionMode: "acceptEdits",
          abortController,
          includePartialMessages: true, // Enable incremental text streaming
          allowedTools: [
            // "Bash",
            // "Glob",
            "Grep",
            "Read",
            // Not allowing Edit/Write since we're just analyzing
          ],
        },
      });

      metadata.set("status", "Generating response...");
      metadata.set("progress", 80);

      // Stream text using writer API
      const { waitUntilComplete } = agentStream.writer({
        execute: async ({ write }) => {
          for await (const message of result) {
            // During tool use phase - update metadata with tool names
            if (message.type === "assistant" && message.message?.content) {
              const toolNames: string[] = [];
              for (const block of message.message.content) {
                if (block.type === "tool_use") {
                  toolNames.push(block.name);
                }
              }
              if (toolNames.length > 0) {
                metadata.set("status", `Analyzing: ${toolNames.join(", ")}`);
              }
            }

            // Handle incremental text deltas from stream events
            if (message.type === "stream_event") {
              const event = message.event;
              if (
                event.type === "content_block_delta" &&
                event.delta.type === "text_delta"
              ) {
                metadata.set("status", "Streaming response...");
                write(event.delta.text);
              }
            }
          }
        },
      });

      await waitUntilComplete();

      metadata.set("status", "Completed");
      metadata.set("progress", 100);

      // Cleanup temp directory
      console.log("[analyze-repo] Cleaning up temp directory...");
      try {
        await rm(tempDir, { recursive: true, force: true });
        console.log("[analyze-repo] Cleanup successful");
      } catch (e) {
        console.error("[analyze-repo] Cleanup error:", e);
      }

      return {
        repoName,
        question,
        status: "completed",
      };
    } catch (error: any) {
      // Ensure cleanup on any error
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch (e) {
        console.error("[analyze-repo] Error cleanup failed:", e);
      }

      metadata.set("status", "Failed");
      metadata.set("error", error.message);

      // Stream error message as plain text
      agentStream.writer({
        execute: async ({ write }) => {
          write(`Error: ${error.message}`);
        },
      });

      throw error;
    }
  },
});
