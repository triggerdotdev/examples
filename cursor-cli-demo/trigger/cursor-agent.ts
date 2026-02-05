import { logger, streams, task } from "@trigger.dev/sdk";
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

    const agent = spawnCursorAgent(
      ["-p", "--force", "--output-format", "stream-json", "--model", model, payload.prompt],
      { cwd: workspace, env: { CURSOR_API_KEY: process.env.CURSOR_API_KEY } },
    );

    const { waitUntilComplete } = streams.pipe("cursor-events", agent.stream);

    const { exitCode, stderr } = await agent.waitUntilExit();
    await waitUntilComplete();

    if (exitCode !== 0) {
      logger.error("cursor-agent failed", { exitCode, stderr });
      throw new Error(stderr || `cursor-agent exited with code ${exitCode}`);
    }

    return { exitCode, prompt: payload.prompt };
  },
});
