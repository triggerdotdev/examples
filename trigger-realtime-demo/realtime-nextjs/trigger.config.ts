import { defineConfig } from "@trigger.dev/sdk/v3"

export default defineConfig({
  project: "proj_placeholder", // Replace with your project ref
  runtime: "node",
  logLevel: "info",
  maxDuration: 300,
  dirs: ["./src/trigger"],
})
