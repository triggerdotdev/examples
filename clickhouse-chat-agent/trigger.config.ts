import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF!,
  runtime: "node-22",
  maxDuration: 3600,
  dirs: ["./src/trigger"],
});
