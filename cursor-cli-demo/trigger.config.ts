import { defineConfig } from "@trigger.dev/sdk";
import { cursorCli } from "./extensions/cursor-cli";

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
