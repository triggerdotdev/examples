import { streams } from "@trigger.dev/sdk";

// REALTIME STREAMS V2: Define typed stream for text responses only
// This stream will carry just the text strings from Claude's responses
export const agentStream = streams.define<string>({
  id: "agent-messages",
});