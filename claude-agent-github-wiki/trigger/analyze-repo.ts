import { schemaTask, metadata } from "@trigger.dev/sdk";
import { z } from "zod";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
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
    metadata.set("status", "Validating repository...");
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
      const cloneCmd = `git clone --depth=1 --single-branch "${repoUrl}" "${tempDir}/repo"`;

      try {
        await execAsync(cloneCmd, {
          timeout: 120000, // 2 minute timeout for clone
          signal: abortController.signal,
        });
        console.log(`Successfully cloned ${repoName}`);
      } catch (cloneError: any) {
        // Cleanup temp dir on clone failure
        await rm(tempDir, { recursive: true, force: true });

        if (cloneError.code === 128 || cloneError.stderr?.includes("not found")) {
          throw new Error(
            `Failed to clone repository. It may be private, not exist, or the URL is invalid.`
          );
        }
        throw new Error(`Clone failed: ${cloneError.message}`);
      }

      metadata.set("status", "Analyzing codebase...");
      metadata.set("progress", 50);

      // Get repository size for warning
      const { stdout: sizeOutput } = await execAsync(
        `du -sh "${tempDir}/repo" | cut -f1`,
        { signal: abortController.signal }
      );
      metadata.set("repoSize", sizeOutput.trim());

      // Create a developer-focused system prompt
      const systemPrompt = `You are analyzing the ${repoName} repository.

First, provide a brief 2-3 sentence overview of what this repository contains and its main purpose.

Then, provide a detailed response to the user's question. Focus on technical accuracy and be specific with file references and code examples where relevant.

User's question: ${question}`;

      metadata.set("status", "Generating response...");
      metadata.set("progress", 70);

      // Process with Claude Agent SDK
      const result = query({
        prompt: systemPrompt,
        options: {
          model: "claude-sonnet-4-20250514",
          cwd: join(tempDir, "repo"),
          maxTurns: 5, // Reduced from 10 since it's single question
          permissionMode: "acceptEdits",
          allowedTools: [
            "Task",
            "Bash",
            "Glob",
            "Grep",
            "Read",
            // Removed Edit and Write since we're just analyzing
          ],
        },
      });

      // Stream the response
      metadata.set("status", "Streaming response...");
      metadata.set("progress", 90);

      for await (const message of result) {
        console.log("[analyze-repo] Streaming:", message.type);

        // Write to stream for frontend consumption
        agentStream.writer({
          execute: async ({ write }) => {
            write(message);
          },
        });

        // Update metadata when we get text responses
        if (message.type === "assistant" && message.message.content) {
          const textContent = message.message.content.find(c => c.type === "text");
          if (textContent && "text" in textContent) {
            metadata.append("responseChunks", textContent.text);
          }
        }
      }

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

      // Stream error message
      agentStream.writer({
        execute: async ({ write }) => {
          write({
            type: "assistant",
            message: {
              role: "assistant",
              content: [{
                type: "text",
                text: `Error: ${error.message}`,
              }],
            },
          } as SDKMessage);
        },
      });

      throw error;
    }
  },
});