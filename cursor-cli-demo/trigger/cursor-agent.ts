import { logger, metadata, task } from "@trigger.dev/sdk";
import { mkdirSync } from "fs";
import type { CursorEvent } from "@/lib/cursor-events";
import { spawnCursorAgent } from "../extensions/cursor-cli";

export type CursorAgentPayload = {
  prompt: string;
  model?: string;
};

export type STREAMS = {
  "cursor-events": CursorEvent;
};

export const cursorAgentTask = task({
  id: "cursor-agent",
  machine: "medium-2x",
  maxDuration: 300,
  run: async (payload: CursorAgentPayload) => {
    const workspace = `/tmp/workspace-${Date.now()}`;
    mkdirSync(workspace, { recursive: true });

    const model = payload.model ?? "sonnet-4.5";

    logger.info("Spawning cursor-agent", { workspace, model });

    const child = spawnCursorAgent(
      ["-p", "--force", "--output-format", "stream-json", "--model", model, payload.prompt],
      { cwd: workspace, env: { CURSOR_API_KEY: process.env.CURSOR_API_KEY } },
    );

    let spawnError: Error | null = null;
    child.on("error", (err) => {
      spawnError = err;
      logger.error("cursor-agent spawn error", { message: err.message });
    });

    let stderr = "";
    let rawStdout = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
      logger.warn("cursor-agent stderr", { text: chunk.toString() });
    });

    let buffer = "";
    let streamClosed = false;
    const ndjsonStream = new ReadableStream<CursorEvent>({
      start(controller) {
        const safeClose = () => {
          if (!streamClosed) {
            streamClosed = true;
            controller.close();
          }
        };

        child.stdout.on("data", (chunk: Buffer) => {
          rawStdout += chunk.toString();
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.trim()) {
              try {
                controller.enqueue(JSON.parse(line));
              } catch {
                logger.warn("Malformed NDJSON line", { line });
              }
            }
          }
        });

        child.stdout.on("end", () => {
          if (buffer.trim()) {
            try {
              controller.enqueue(JSON.parse(buffer));
            } catch {
              // skip
            }
          }
          safeClose();
        });

        child.stdout.on("error", () => safeClose());
        child.on("error", () => safeClose());
      },
    });

    const stream = await metadata.stream("cursor-events", ndjsonStream);

    for await (const event of stream) {
      logger.debug("cursor event", { type: event.type });
    }

    const exitCode = await new Promise<number>((resolve) => {
      if (child.exitCode !== null) {
        resolve(child.exitCode);
        return;
      }
      child.on("close", (code) => resolve(code ?? 1));
    });

    if (spawnError !== null) {
      throw new Error(
        `cursor-agent failed to start: ${(spawnError as Error).message}`,
      );
    }

    if (exitCode !== 0) {
      logger.error("cursor-agent failed", { exitCode, stderr, rawStdout: rawStdout.slice(0, 2000) });
      throw new Error(stderr || rawStdout.slice(0, 500) || `cursor-agent exited with code ${exitCode}`);
    }

    return {
      exitCode,
      prompt: payload.prompt,
      stderr: exitCode !== 0 ? stderr : undefined,
    };
  },
});
