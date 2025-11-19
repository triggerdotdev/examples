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
  maxDuration: 3600, // 60 minutes for extended chat sessions
  run: async ({ tempDir, sessionId, repoName }, { signal }) => {
    // NOTE: Clean up console.logs after debugging
    console.log("[repo-chat] Starting session:", { sessionId, repoName });

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PRIVATE_KEY!,
      {
        realtime: {
          params: {
            apikey: process.env.SUPABASE_PRIVATE_KEY!,
            eventsPerSecond: 10,
          },
          timeout: 60000,
        },
        auth: {
          persistSession: false,
        },
      },
    );

    // Create abort controller for Claude
    const abortController = new AbortController();

    // Subscribe to questions via Supabase Broadcast
    const channelName = `session:${sessionId}`;
    console.log("[repo-chat] Creating channel:", channelName);

    // NOTE: Clean up console.logs after debugging
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: {
          self: false,
          ack: false, // Don't wait for ack to avoid timeouts
        },
      },
    });

    let isProcessing = false;
    let shouldExit = false;

    // Setup abort handler
    const abortHandler = () => {
      console.log("[repo-chat] Aborting session");
      shouldExit = true;
      abortController.abort();
      channel.unsubscribe();
    };

    signal.addEventListener("abort", abortHandler);

    // Use writer() to stream responses via Trigger.dev Streams v2
    const { waitUntilComplete } = agentStream.writer({
      execute: async ({ write }) => {
        // Write initial ready message
        write({
          type: "text",
          text:
            "Chat session ready! You can now ask questions about the repository.",
        } as unknown as SDKMessage);

        // Add a debug listener for ALL broadcast events
        channel.on("broadcast", { event: "*" }, (msg) => {
          console.log("[repo-chat] Broadcast received (any event):", msg);
        });

        channel
          .on("broadcast", { event: "question" }, async ({ payload }) => {
            console.log(
              "[repo-chat] Question event triggered with payload:",
              payload,
            );

            if (isProcessing) {
              write({
                type: "text",
                text: "Already processing a question, please wait...",
              } as unknown as SDKMessage);
              return;
            }

            isProcessing = true;
            const { question: userQuestion, messageId } = payload;

            console.log("[repo-chat] Question received:", userQuestion);

            // Echo question to stream for UI display
            write({
              type: "text",
              text: `User: ${userQuestion}`,
            } as unknown as SDKMessage);

            try {
              // Process with Claude using the query function
              const result = query({
                prompt: userQuestion,
                options: {
                  model: "claude-sonnet-4-20250514",
                  maxThinkingTokens: 8192,
                  abortController,
                  cwd: tempDir, // Set working directory to cloned repo
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

              // Stream all messages through Trigger Streams v2
              for await (const message of result) {
                console.log("[repo-chat] Streaming message:", message.type);
                write(message);

                // Check if we should exit
                if (shouldExit) {
                  break;
                }
              }
            } catch (error: any) {
              console.error("[repo-chat] Error:", error.message);
              write({
                type: "text",
                text: `Error: ${error.message}`,
              } as unknown as SDKMessage);
            } finally {
              isProcessing = false;
            }
          })
          .on("broadcast", { event: "end_session" }, () => {
            console.log("[repo-chat] End session signal received");
            shouldExit = true;
            channel.unsubscribe();
          });

        // Subscribe with async/await for better error handling
        console.log("[repo-chat] Subscribing to channel:", channelName);

        // Add a small delay to let frontend establish channel first
        console.log("[repo-chat] Waiting 2s for frontend to initialize...");
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const subscribeResult = await new Promise<
          { status: string; error?: any }
        >((resolve) => {
          let timeoutId: NodeJS.Timeout;

          // Set a manual timeout of 10 seconds
          timeoutId = setTimeout(() => {
            console.error("[repo-chat] Manual timeout after 10s");
            resolve({
              status: "MANUAL_TIMEOUT",
              error: new Error("Subscription timed out after 10 seconds"),
            });
          }, 10000);

          channel.subscribe((status, err) => {
            console.log(`[repo-chat] Subscription status: ${status}`);

            if (status === "SUBSCRIBED") {
              clearTimeout(timeoutId);
              console.log("[repo-chat] ✅ Successfully subscribed");
              write({
                type: "text",
                text: "Connected to chat session. Ready for questions!",
              } as unknown as SDKMessage);
              resolve({ status });
            } else if (
              status === "TIMED_OUT" || status === "CHANNEL_ERROR" ||
              status === "CLOSED"
            ) {
              clearTimeout(timeoutId);
              console.error(
                `[repo-chat] ❌ Subscription failed: ${status}`,
                err,
              );
              resolve({
                status,
                error: err || new Error(`Subscription failed: ${status}`),
              });
            }
          });
        });

        // Validate subscription succeeded
        if (subscribeResult.status !== "SUBSCRIBED") {
          throw new Error(
            `Failed to subscribe: ${
              subscribeResult.error?.message || subscribeResult.status
            }`,
          );
        }

        // Keep alive until abort signal
        await new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            if (shouldExit || signal.aborted) {
              clearInterval(checkInterval);
              resolve(undefined);
            }
          }, 1000);
        });
      },
    });

    // Wait for the stream to complete
    try {
      await waitUntilComplete();
    } catch (error) {
      console.error("[repo-chat] Session error:", error);
    } finally {
      // Cleanup
      console.log("[repo-chat] Cleaning up session");

      channel.unsubscribe();
      signal.removeEventListener("abort", abortHandler);

      // Clean up the cloned repository
      try {
        await rm(tempDir, { recursive: true, force: true });
        console.log("[repo-chat] Temp directory cleaned");
      } catch (cleanupError) {
        console.error("[repo-chat] Failed to clean temp dir:", cleanupError);
      }
    }

    return {
      sessionId,
      repoName,
      status: "completed",
    };
  },
});
