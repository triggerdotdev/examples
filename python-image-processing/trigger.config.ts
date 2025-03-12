import { pythonExtension } from "@trigger.dev/python/extension";
import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  runtime: "node",
  project: "<your-project-id>",
  machine: "small-1x",
  maxDuration: 3600,
  build: {
    extensions: [
      pythonExtension({
        requirementsFile: "./requirements.txt",
        devPythonBinaryPath: `venv/bin/python`,
        scripts: ["src/python/**/*.py"],
      }),
    ],
  },
});
