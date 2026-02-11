import type { BuildExtension } from "@trigger.dev/build";
import { spawn } from "child_process";
import { chmodSync, copyFileSync, existsSync, readdirSync } from "fs";
import type { CursorEvent } from "@/lib/cursor-events";
import { logger } from "@trigger.dev/sdk";

/** Where the build layer copies cursor-agent's resolved files */
export const CURSOR_AGENT_DIR = "/usr/local/lib/cursor-agent";

/** Install the Cursor CLI binary into the Trigger.dev container image */
export function cursorCli(): BuildExtension {
  return {
    name: "cursor-cli",
    onBuildComplete(context) {
      if (context.target === "dev") return;

      context.addLayer({
        id: "cursor-cli",
        image: {
          instructions: [
            "RUN apt-get update && apt-get install -y curl ca-certificates && rm -rf /var/lib/apt/lists/*",
            'ENV PATH="/root/.local/bin:$PATH"',
            "RUN curl -fsSL https://cursor.com/install | bash",
            // Copy the resolved index.js + deps to a fixed path so we can invoke with process.execPath at runtime
            `RUN cp -r $(dirname $(readlink -f /root/.local/bin/cursor-agent)) ${CURSOR_AGENT_DIR}`,
          ],
        },
      });
    },
  };
}

export type ExitResult = {
  exitCode: number;
  stderr: string;
};

export type CursorAgent = {
  stream: ReadableStream<CursorEvent>;
  waitUntilExit: () => Promise<ExitResult>;
  kill: () => void;
};

type SpawnCursorAgentOptions = {
  cwd: string;
  env?: Record<string, string | undefined>;
};

/**
 * Spawn cursor-agent at runtime inside the Trigger.dev container.
 *
 * Returns a NDJSON ReadableStream of CursorEvents and a waitUntilExit()
 * that resolves with the exit code and stderr.
 *
 * Handles the /tmp copy + chmod workaround needed because the runtime
 * strips execute permissions, and cursor-agent's native .node modules
 * require its bundled node (ABI mismatch with container node).
 */
export function spawnCursorAgent(
  args: string[],
  options: SpawnCursorAgentOptions,
): CursorAgent {
  const entryPoint = `${CURSOR_AGENT_DIR}/index.js`;
  const bundledNode = `${CURSOR_AGENT_DIR}/node`;
  const tmpNode = "/tmp/cursor-node";

  if (!existsSync(entryPoint)) {
    const dirExists = existsSync(CURSOR_AGENT_DIR);
    throw new Error(
      `cursor-agent not found at ${entryPoint}. Dir: ${dirExists}. Contents: ${dirExists ? readdirSync(CURSOR_AGENT_DIR).join(", ") : "N/A"}`,
    );
  }

  try {
    copyFileSync(bundledNode, tmpNode);
    chmodSync(tmpNode, 0o755);
  } catch (err: unknown) {
    // ETXTBSY = file is being executed by another run on this machine — safe to skip
    if (!(err instanceof Error && "code" in err && err.code === "ETXTBSY")) {
      throw err;
    }
  }

  const child = spawn(tmpNode, [entryPoint, ...args], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ...options.env,
      CURSOR_INVOKED_AS: "cursor-agent",
    },
    cwd: options.cwd,
  });

  // Collect stderr
  let stderr = "";
  child.stderr!.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
    logger.warn("cursor-agent stderr", { text: chunk.toString() });
  });

  // Build NDJSON ReadableStream from stdout
  let buffer = "";
  let streamClosed = false;
  const stream = new ReadableStream<CursorEvent>({
    start(controller) {
      const safeClose = () => {
        if (!streamClosed) {
          streamClosed = true;
          controller.close();
        }
      };

      child.stdout!.on("data", (chunk: Buffer) => {
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

      child.stdout!.on("end", () => {
        if (buffer.trim()) {
          try {
            controller.enqueue(JSON.parse(buffer));
          } catch {
            // skip
          }
        }
        safeClose();
      });

      child.stdout!.on("error", () => safeClose());
      child.on("error", () => safeClose());
    },
  });

  // waitUntilExit resolves when the child process exits
  const waitUntilExit = (): Promise<ExitResult> =>
    new Promise((resolve) => {
      if (child.exitCode !== null) {
        resolve({ exitCode: child.exitCode, stderr });
        return;
      }
      child.on("close", (code) => {
        resolve({ exitCode: code ?? 1, stderr });
      });
    });

  const kill = () => {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
    }
  };

  return { stream, waitUntilExit, kill };
}
