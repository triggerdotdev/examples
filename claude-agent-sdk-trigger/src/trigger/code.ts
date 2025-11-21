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
 * Basic example: Safe code generation with isolated workspace
 * - Isolated temp directory per task run (no shared state)
 * - Minimal environment variables (no HOME/USER access)
 * - No bash execution (permissionMode: "enabled" with safe tools only)
 * - Automatic cleanup of temp directory
 * Good for: code generation, file analysis, data transformation
 * NOT for: npm install, running tests, build commands (see advanced example)
 */
export const codeTask = schemaTask({
  id: "claude-code",
  schema: z.object({
    prompt: z.string(),
    maxTurns: z.number().default(3),
    maxIterations: z.number().default(10),
  }),
  run: async ({ prompt, maxTurns, maxIterations }, { signal }) => {
    const abortController = new AbortController();

    signal.addEventListener("abort", () => {
      abortController.abort();
    });

    // Create a unique isolated directory for this task run
    // This prevents interference between concurrent runs
    const tempDir = await mkdtemp(join(tmpdir(), "claude-agent-"));

    // Only expose minimal environment variables
    // No HOME/USER to prevent access to ~/.aws, ~/.ssh, etc.
    const safeEnv = {
      PATH: process.env.PATH ?? "",
      TMPDIR: tempDir, // Point to our isolated directory
    };

    logger.log("Starting agent loop", {
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
            // SECURITY: "default" mode requires user approval for potentially dangerous operations
            // "acceptEdits" auto-approves file edits but requires approval for bash/network
            // "bypassPermissions" NEVER use - disables all safety checks
            // See advanced example for handling approvals programmatically
            permissionMode: "acceptEdits",
            allowedTools: [
              // Planning and analysis tools
              "Task",
              "Glob",
              "Grep",
              // File operations (safe - limited to cwd)
              "Read",
              "Edit",
              "Write",
              // Utility tools
              "TodoRead",
              "TodoWrite",
              // Removed: Bash (no command execution)
              // Removed: WebFetch, WebSearch (add if needed for your use case)
              // Removed: NotebookRead/Edit (add if needed)
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

          break; // break out of the loop
        }
      }
    } finally {
      // Always cleanup the temp directory, even if task fails
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
  // TODO: save messages to a database
}
