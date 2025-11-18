import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { schemaTask, logger } from "@trigger.dev/sdk";
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
    // Supabase for receiving questions (control plane only)
    logger.info("Initializing Supabase client", {
      url: process.env.SUPABASE_URL,
      hasKey: !!process.env.SUPABASE_PRIVATE_KEY
    });

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PRIVATE_KEY!,
      {
        realtime: {
          params: {
            apikey: process.env.SUPABASE_PRIVATE_KEY!, // Explicitly pass the API key
            eventsPerSecond: 10,
          },
          timeout: 60000, // Increase timeout to 60 seconds
        },
        auth: {
          persistSession: false,
        },
      }
    );

    // Create abort controller for Claude
    const abortController = new AbortController();

    // Subscribe to questions via Supabase Broadcast
    const channelName = `session:${sessionId}`;
    logger.info("Creating Supabase channel", { channelName });

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: {
          self: false, // Don't receive own broadcasts
          ack: true,   // Wait for acknowledgment
        },
        private: false, // Use public channel (private channels may not work with this key type)
      },
    });

    let isProcessing = false;
    let shouldExit = false;

    // Setup abort handler
    const abortHandler = () => {
      logger.info("Received abort signal, cleaning up...");
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
          text: "Chat session ready! You can now ask questions about the repository.",
        } as unknown as SDKMessage);

        channel
          .on('broadcast', { event: 'question' }, async ({ payload }) => {
            if (isProcessing) {
              write({
                type: "text",
                text: "Already processing a question, please wait...",
              } as unknown as SDKMessage);
              return;
            }

            isProcessing = true;
            const { question: userQuestion, messageId } = payload;

            logger.info("Received question", { question: userQuestion, messageId, sessionId });

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
                // All AI responses flow through Trigger Streams v2
                write(message);

                // Check if we should exit
                if (shouldExit) {
                  break;
                }
              }

            } catch (error: any) {
              logger.error("Error processing question", {
                error: error.message,
                sessionId,
                messageId
              });

              write({
                type: "text",
                text: `Error: ${error.message}`,
              } as unknown as SDKMessage);
            } finally {
              isProcessing = false;
            }
          })
          .on('broadcast', { event: 'end_session' }, () => {
            logger.info("Received end session signal", { sessionId });
            shouldExit = true;
            channel.unsubscribe();
          });

        // Subscribe with async/await for better error handling
        logger.info("Attempting to subscribe to channel", { channelName });

        const subscribeResult = await new Promise<{ status: string; error?: any }>((resolve) => {
          channel.subscribe((status, err) => {
            logger.info("Supabase subscription status", { status, error: err, sessionId, channelName });

            if (status === 'TIMED_OUT') {
              logger.error("Supabase subscription timed out - this may indicate network issues or invalid credentials", {
                sessionId,
                channelName,
                supabaseUrl: process.env.SUPABASE_URL
              });
              resolve({ status, error: err || new Error("Subscription timed out") });
            } else if (status === 'SUBSCRIBED') {
              logger.info("Successfully subscribed to Supabase channel", { sessionId, channelName });
              write({
                type: "text",
                text: "Connected to chat session. Ready for questions!",
              } as unknown as SDKMessage);
              resolve({ status });
            } else if (status === 'CHANNEL_ERROR') {
              logger.error("Supabase channel error", { error: err, sessionId, channelName });
              resolve({ status, error: err || new Error("Channel error") });
            } else if (status === 'CLOSED') {
              logger.error("Supabase channel closed unexpectedly", { sessionId, channelName });
              resolve({ status, error: new Error("Channel closed") });
            }
          });
        });

        // Validate subscription succeeded
        if (subscribeResult.status !== 'SUBSCRIBED') {
          throw new Error(`Failed to subscribe to Supabase channel: ${subscribeResult.error?.message || subscribeResult.status}`);
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
      logger.error("Error in chat session", { error, sessionId });
    } finally {
      // Cleanup
      logger.info("Cleaning up chat session", { sessionId, tempDir });

      // Unsubscribe from Supabase
      channel.unsubscribe();

      // Remove abort handler
      signal.removeEventListener("abort", abortHandler);

      // Clean up the cloned repository
      try {
        await rm(tempDir, { recursive: true, force: true });
        logger.info("Successfully cleaned up temp directory", { tempDir });
      } catch (cleanupError) {
        logger.error("Failed to clean up temp directory", {
          tempDir,
          error: cleanupError
        });
      }
    }

    return {
      sessionId,
      repoName,
      status: "completed"
    };
  },
});