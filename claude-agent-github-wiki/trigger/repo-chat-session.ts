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

    // Create Supabase client - use publishable key for listening
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
      {
        realtime: {
          params: { eventsPerSecond: 10 },
        },
      }
    );

    // // Create stream writer
    // const streamWriter = agentStream.writer();

    // // Write initial message
    // streamWriter.write({
    //   type: "text",
    //   text: "Chat session ready! Ask questions about the repository.",
    // } as unknown as SDKMessage);

    // Subscribe to Supabase channel AT TASK LEVEL (not inside writer!)
    const channel = supabase.channel(`session:${sessionId}`);

    // Listen for questions
    channel.on("broadcast", { event: "question" }, async ({ payload }) => {
      console.log("[repo-chat] Question received:", payload?.question);

      const userQuestion = payload?.question;
    //   if (!userQuestion) return;

    //   // Echo question
    //   streamWriter.write({
    //     type: "text",
    //     text: `User: ${userQuestion}`,
    //   } as unknown as SDKMessage);

    //   try {
    //     // Process with Claude
    //     const result = query({
    //       prompt: userQuestion,
    //       options: {
    //         model: "claude-sonnet-4-20250514",
    //         cwd: tempDir,
    //         maxTurns: 10,
    //         permissionMode: "acceptEdits",
    //         allowedTools: ["Task", "Bash", "Glob", "Grep", "Read", "Edit", "Write"],
    //       },
    //     });

    //     // Stream responses
    //     for await (const message of result) {
    //       console.log("[repo-chat] Streaming:", message.type);
    //       streamWriter.write(message);
    //     }
    //   } catch (error: any) {
    //     console.error("[repo-chat] Error:", error.message);
    //     streamWriter.write({
    //       type: "text",
    //       text: `Error: ${error.message}`,
    //     } as unknown as SDKMessage);
    //   }
    // });

    // Subscribe to channel
    console.log("[repo-chat] Subscribing to channel...");
    const status = await new Promise<string>((resolve) => {
      channel.subscribe((status) => {
        console.log(`[repo-chat] Status: ${status}`);
        if (status === "SUBSCRIBED" || status === "CLOSED" || status === "CHANNEL_ERROR") {
          resolve(status);
        }
      });
    });

    if (status !== "SUBSCRIBED") {
      throw new Error(`Failed to subscribe: ${status}`);
    }

    console.log("[repo-chat] ✅ Subscribed successfully");

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