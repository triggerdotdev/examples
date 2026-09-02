import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  // Replace with your own project ref from the Trigger.dev dashboard,
  // or set TRIGGER_PROJECT_REF.
  project: process.env.TRIGGER_PROJECT_REF ?? "<your-project-ref>",
  dirs: ["./trigger"],
  maxDuration: 3600,
});
