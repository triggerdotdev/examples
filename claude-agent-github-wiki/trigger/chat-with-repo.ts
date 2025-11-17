import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { schemaTask, streams } from "@trigger.dev/sdk";
import { z } from "zod";
import { access } from "fs/promises";

// REALTIME STREAMS V2: Define typed stream for all agent messages
export const agentStream = streams.define<SDKMessage>({
  id: "agent-messages",
});

export const chatWithRepo = schemaTask({
  id: "chat-with-repo",
  schema: z.object({
    tempDir: z.string(),
    question: z.string().min(1),
    repoName: z.string().optional(),
  }),
  run: async ({ tempDir, question, repoName }, { signal }) => {
    const abortController = new AbortController();

    signal.addEventListener("abort", () => {
      abortController.abort();
    });

    // Verify temp directory still exists
    try {
      await access(tempDir);
    } catch {
      throw new Error(
        `Repository directory no longer exists. It may have been cleaned up. Please clone the repository again.`,
      );
    }

    console.log(
      `Starting chat query for ${repoName || tempDir}: "${question}"`,
    );

    try {
      // Initialize Claude Agent query with streaming
      const result = query({
        prompt: question,
        options: {
          model: "claude-sonnet-4-20250514",
          maxThinkingTokens: 8192,
          abortController,
          cwd: tempDir,
          maxTurns: 10,
          permissionMode: "acceptEdits",
          allowedTools: [
            "Task",
            "Bash",
            "Glob",
            "Grep",
            "Read",
            "Edit",
            "Write",
          ],
        },
      });

      // Pipe messages to realtime stream
      const { waitUntilComplete, stream } = agentStream.pipe(result);

      // You can iterate locally if needed
      for await (const chunk of result) {
        console.log("Chunk generated:", chunk);
      }

      // Stream all messages in real-time to the frontend
      await waitUntilComplete();

      console.log(`Chat query completed successfully`);
      return { success: true, repoName };
    } catch (err) {
      const error = err as Error;
      console.error(`Chat task failed:`, error);

      throw error;
    }
  },
});
