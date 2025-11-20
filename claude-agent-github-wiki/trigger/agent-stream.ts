import { streams } from "@trigger.dev/sdk";
import { type SDKMessage } from "@anthropic-ai/claude-agent-sdk";

// REALTIME STREAMS V2: Define typed stream for all agent messages
// This stream will carry every SDKMessage from the Claude Agent (text, tool_use, tool_result)
export const agentStream = streams.define<string>({
  id: "agent-messages",
});
