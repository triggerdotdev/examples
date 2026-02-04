import { defineConfig } from "@trigger.dev/sdk";

import type { BuildExtension } from "@trigger.dev/build";

/** Install the Cursor CLI binary into the Trigger.dev container image */
function cursorCli(): BuildExtension {
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
            "RUN cp -r $(dirname $(readlink -f /root/.local/bin/cursor-agent)) /usr/local/lib/cursor-agent",
          ],
        },
      });
    },
  };
}

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF!,
  runtime: "node",
  logLevel: "log",
  maxDuration: 300,
  dirs: ["./trigger"],
  build: {
    extensions: [cursorCli()],
  },
});
