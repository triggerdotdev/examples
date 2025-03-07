import { defineConfig } from "@trigger.dev/sdk/v3";
import { pythonExtension } from "@trigger.dev/python/extension";
import { playwrightExtension } from "./src/extensions/playwrightExtension.js";

// function playwrightExtension(): BuildExtension {
//   return {
//     name: "playwright-extension",
//     onBuildComplete: async (context) => {
//       context.addLayer({
//         id: "playwright-setup",
//         image: {
//           pkgs: [
//             "libnss3",
//             "libnspr4",
//             "libatk1.0-0",
//             "libatk-bridge2.0-0",
//             "libcups2",
//             "libdrm2",
//             "libdbus-1-3",
//             "libxkbcommon0",
//             "libxcomposite1",
//             "libxdamage1",
//             "libxfixes3",
//             "libxrandr2",
//             "libgbm1",
//             "libasound2",
//             "libpango-1.0-0",
//             "libcairo2",
//           ],
//         },
//         commands: [
//           "source /opt/venv/bin/activate && python -m playwright install chromium",
//           "source /opt/venv/bin/activate && python -m playwright install-deps",
//         ],
//         build: {
//           env: {
//             VIRTUAL_ENV: "/opt/venv",
//             PATH: "/opt/venv/bin:${PATH}",
//           },
//         },
//       });
//     },
//   };
// }

export default defineConfig({
  runtime: "node",
  project: "proj_evoftjmqvmvjeublxlqx",
  machine: "small-1x",
  maxDuration: 3600,
  build: {
    extensions: [
      pythonExtension({
        requirementsFile: "./requirements.txt",
        devPythonBinaryPath: `.venv/bin/python`,
        scripts: ["src/python/**/*.py"],
      }),
      playwrightExtension(),
    ],
  },
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 1,
      minTimeoutInMs: 1_000,
      maxTimeoutInMs: 5_000,
      factor: 1.6,
      randomize: true,
    },
  },
});
