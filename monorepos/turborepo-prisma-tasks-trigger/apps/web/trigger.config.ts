import { defineConfig } from "@trigger.dev/sdk/v3";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";

export default defineConfig({
  project: "<your-project-ref>", // Replace with your project reference
  runtime: "node",
  logLevel: "log",
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // You can override this on an individual task.
  // See https://trigger.dev/docs/runs/max-duration
  maxDuration: 3600,
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
  build: {
    extensions: [
      prismaExtension({
        // Use the same version as the database package, this is required for the prisma extension to work
        version: "6.5.0",
        schema: "../../packages/database/prisma/schema.prisma",
      }),
    ],
  },
  dirs: ["./src/trigger"],
});
