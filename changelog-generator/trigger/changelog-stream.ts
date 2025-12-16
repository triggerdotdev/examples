import { streams } from "@trigger.dev/sdk";

export const changelogStream = streams.define<string>({
  id: "changelog-output",
});
