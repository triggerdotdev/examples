import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  // Your project ref, from the Trigger.dev dashboard (Project settings).
  project: "proj_your_project_ref",
  dirs: ["./src/trigger"],
  // The meeting agent overrides this with its own, longer maxDuration.
  maxDuration: 300,
});
