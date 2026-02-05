import type { BuildExtension } from "@trigger.dev/build";
import type { ChildProcess } from "child_process";
import { spawn } from "child_process";
import { chmodSync, copyFileSync, existsSync, readdirSync } from "fs";
import type { Readable } from "stream";

export type CursorAgentProcess = ChildProcess & {
  stdout: Readable;
  stderr: Readable;
};

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

type SpawnCursorAgentOptions = {
  cwd: string;
  env?: Record<string, string | undefined>;
};

/**
 * Spawn cursor-agent at runtime inside the Trigger.dev container.
 *
 * Handles the /tmp copy + chmod workaround needed because the runtime
 * strips execute permissions, and cursor-agent's native .node modules
 * require its bundled node (ABI mismatch with container node).
 */
export function spawnCursorAgent(
  args: string[],
  options: SpawnCursorAgentOptions,
): CursorAgentProcess {
  const entryPoint = `${CURSOR_AGENT_DIR}/index.js`;
  const bundledNode = `${CURSOR_AGENT_DIR}/node`;
  const tmpNode = "/tmp/cursor-node";

  if (!existsSync(entryPoint)) {
    const dirExists = existsSync(CURSOR_AGENT_DIR);
    throw new Error(
      `cursor-agent not found at ${entryPoint}. Dir: ${dirExists}. Contents: ${dirExists ? readdirSync(CURSOR_AGENT_DIR).join(", ") : "N/A"}`,
    );
  }

  copyFileSync(bundledNode, tmpNode);
  chmodSync(tmpNode, 0o755);

  // stdio: ["ignore", "pipe", "pipe"] guarantees stdout/stderr are non-null
  return spawn(tmpNode, [entryPoint, ...args], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ...options.env,
      CURSOR_INVOKED_AS: "cursor-agent",
    },
    cwd: options.cwd,
  }) as CursorAgentProcess;
}
