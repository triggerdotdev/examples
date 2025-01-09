import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "<your project ref here>",
  runtime: "node",
  logLevel: "log",
  maxDuration: 300, // 5 minutes
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger"],
});
