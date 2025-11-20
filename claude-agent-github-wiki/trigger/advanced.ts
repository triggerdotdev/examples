import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { logger, metadata, schemaTask, wait } from "@trigger.dev/sdk";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

type CHUNK = { iteration: number; message: SDKMessage };

export type STREAMS = {
  claude: CHUNK;
};

/**
 * Advanced example: Full development workflow with bash execution
 * - Isolated temp directory per task run
 * - Minimal environment variables
 * - Bash execution enabled for running commands
 * - Automatic cleanup
 * Good for: npm install, running tests, build commands, git operations
 */
export const codeTaskAdvanced = schemaTask({
  id: "claude-code-advanced",
  schema: z.object({
    prompt: z.string(),
    maxTurns: z.number().default(5),
    maxIterations: z.number().default(10),
  }),
  run: async ({ prompt, maxTurns, maxIterations }, { signal }) => {
    const abortController = new AbortController();

    signal.addEventListener("abort", () => {
      abortController.abort();
    });

    // Create a unique isolated directory for this task run
    const tempDir = await mkdtemp(join(tmpdir(), "claude-agent-adv-"));

    // Minimal environment variables
    // Add NODE_ENV, npm/node paths if needed for your use case
    const safeEnv = {
      PATH: process.env.PATH ?? "",
      TMPDIR: tempDir,
      // Uncomment if needed for npm/node operations:
      // NODE_ENV: "development",
    };

    logger.log("Starting advanced agent loop", {
      cwd: tempDir,
    });

    let $currentPrompt = prompt;
    let sessionId: string | undefined;

    const { stream, write } = createStream<CHUNK>();

    await metadata.stream("claude", stream);

    try {
      for (let i = 0; i < maxIterations; i++) {
        logger.info("Starting iteration", {
          iteration: i,
          prompt: $currentPrompt,
          sessionId,
        });

        const messages: SDKMessage[] = [];

        const result = query({
          prompt: $currentPrompt,
          options: {
            model: "claude-sonnet-4-20250514",
            maxThinkingTokens: 8192,
            abortController,
            resume: sessionId,
            cwd: tempDir,
            env: safeEnv,
            maxTurns,
            // SECURITY: "acceptEdits" auto-approves file edits but still requires
            // the Bash tool to be in allowedTools list for command execution
            // Alternative modes:
            permissionMode: "acceptEdits",
            allowedTools: [
              // All tools including Bash for full development workflow
              "Task",
              "Bash", // SECURITY: Enables command execution
              "Glob",
              "Grep",
              "Read",
              "Edit",
              "Write",
              "TodoRead",
              "TodoWrite",
              // Optional: enable if needed
              // "WebFetch",
              // "WebSearch",
            ],
          },
        });

        for await (const message of result) {
          if (message.type === "system" && message.subtype === "init") {
            sessionId = message.session_id;
          }

          messages.push(message);
          write({ iteration: i, message });
          logger.log("message", { message, iteration: i });
        }

        await saveMessages(messages);

        // This creates a token that will be used to continue the conversation
        const continueToken = await wait.createToken({ timeout: "7d" });

        const nextPrompt = await wait.forToken<{ prompt: string }>(
          continueToken,
        );

        if (nextPrompt.ok) {
          logger.info("Continuing with prompt", {
            prompt: nextPrompt.output.prompt,
          });

          $currentPrompt = nextPrompt.output.prompt;
        } else {
          logger.info("No more prompts", { iteration: i });
          break;
        }
      }
    } finally {
      // Always cleanup the temp directory
      try {
        await rm(tempDir, { recursive: true, force: true });
        logger.info("Cleaned up temp directory", { tempDir });
      } catch (error) {
        logger.error("Failed to cleanup temp directory", {
          tempDir,
          error,
        });
      }
    }

    return {
      success: true,
    };
  },
});

export function createStream<T>(): {
  stream: ReadableStream<T>;
  write: (data: T) => void;
} {
  let controller!: ReadableStreamDefaultController<T>;

  const stream = new ReadableStream({
    start(controllerArg) {
      controller = controllerArg;
    },
  });

  function safeEnqueue(data: T) {
    try {
      controller.enqueue(data);
    } catch (error) {
      // suppress errors when the stream has been closed
    }
  }

  return {
    stream,
    write: safeEnqueue,
  };
}

async function saveMessages(messages: SDKMessage[]) {
  logger.log("Saving messages", { messages });
  // TODO: save messages to a database for audit trail
}
