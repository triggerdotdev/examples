import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import { rm } from "fs/promises";
import { createClient } from "@supabase/supabase-js";
import { agentStream } from "./agent-stream";

export const repoChatSession = schemaTask({
  id: "repo-chat-session",
  schema: z.object({
    tempDir: z.string(),
    sessionId: z.string(),
    repoName: z.string(),
  }),
  maxDuration: 3600,
  run: async ({ tempDir, sessionId, repoName }, { signal }) => {
    console.log("[repo-chat] Starting session:", { sessionId, repoName });

    // Create Supabase client - use secret key for server-side operations
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      {
        realtime: {
          params: { eventsPerSecond: 10 },
        },
      },
    );

    // Write initial message
    agentStream.writer({
      execute: async ({ write }) => {
        // Send a properly formatted assistant message
        write({
          type: "assistant",
          message: {
            role: "assistant",
            content: [{
              type: "text",
              text: "Chat session ready! Ask questions about the repository.",
            }],
          },
        } as SDKMessage);
      },
    });

    // Create and subscribe to channel FIRST
    console.log("[repo-chat] Subscribing to channel...");
    const channel = supabase.channel(`session:${sessionId}`);

    const status = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Subscription timeout after 30s"));
      }, 30000);

      channel.subscribe((status) => {
        console.log(`[repo-chat] Status: ${status}`);
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve(status);
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timeout);
          reject(new Error(`Subscription failed: ${status}`));
        }
      });
    });

    console.log("[repo-chat] ✅ Subscribed successfully");

    // NOW add the event listener after successful subscription
    channel.on("broadcast", { event: "question" }, async ({ payload }) => {
      console.log("[repo-chat] Question received:", payload?.question);

      const userQuestion = payload?.question;
      if (!userQuestion) return;

      // Echo question
      agentStream.writer({
        execute: async ({ write }) => {
          write({
            type: "assistant",
            message: {
              role: "assistant",
              content: [{
                type: "text",
                text: `User: ${userQuestion}`,
              }],
            },
          } as SDKMessage);
        },
      });

      try {
        // Process with Claude
        const result = query({
          prompt: userQuestion,
          options: {
            model: "claude-sonnet-4-20250514",
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

        // Stream responses
        for await (const message of result) {
          console.log("[repo-chat] Streaming:", message.type);
          agentStream.writer({
            execute: async ({ write }) => {
              write(message);
            },
          });
        }
      } catch (error: any) {
        console.error("[repo-chat] Error:", error.message);
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
      }
    });

    // Keep task alive until abort
    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (signal.aborted) {
          clearInterval(interval);
          resolve(undefined);
        }
      }, 1000);
    });

    // Cleanup
    console.log("[repo-chat] Cleaning up...");
    channel.unsubscribe();
    // await streamWriter.waitUntilComplete();

    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      console.error("[repo-chat] Cleanup error:", e);
    }

    return { sessionId, repoName, status: "completed" };
  },
});
