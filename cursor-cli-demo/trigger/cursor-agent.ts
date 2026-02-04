import { logger, metadata, task } from "@trigger.dev/sdk";
import { spawn } from "child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import type { CursorEvent } from "@/lib/cursor-events";

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

    // The Trigger.dev runtime strips execute permissions from all binaries.
    // cursor-agent bundles native .node modules (pty, sqlite3, etc.) compiled for its own node,
    // so we must use cursor-agent's bundled node — not the container's node (ABI mismatch).
    // Workaround: copy the bundled node to /tmp and chmod +x it there.
    const cursorDir = "/usr/local/lib/cursor-agent";
    const entryPoint = `${cursorDir}/index.js`;
    const bundledNode = `${cursorDir}/node`;
    const tmpNode = "/tmp/cursor-node";

    if (!existsSync(entryPoint)) {
      const dirExists = existsSync(cursorDir);
      throw new Error(`cursor-agent not found at ${entryPoint}. Dir: ${dirExists}. Contents: ${dirExists ? readdirSync(cursorDir).join(", ") : "N/A"}`);
    }

    // Copy bundled node to /tmp and make it executable
    copyFileSync(bundledNode, tmpNode);
    chmodSync(tmpNode, 0o755);

    logger.info("Spawning cursor-agent", { node: tmpNode, entryPoint, workspace, model });

    const child = spawn(tmpNode, [
      entryPoint,
      "-p",
      "--force",
      "--output-format",
      "stream-json",
      "--model",
      model,
      payload.prompt,
    ], {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        CURSOR_API_KEY: process.env.CURSOR_API_KEY,
        CURSOR_INVOKED_AS: "cursor-agent",
      },
      cwd: workspace,
    });

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
