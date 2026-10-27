import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF!,
  runtime: "node-22",
  // Compute time only: runs waiting on an Apify webhook or a subtask are suspended and don't count
  maxDuration: 600,
  dirs: ["./src/trigger"],
  build: {
    // The bundled apify-client fails with "ProxyAgent is not a constructor", so load it from node_modules
    external: ["apify-client"],
  },
});
