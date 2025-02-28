import { anthropic } from "@ai-sdk/anthropic";
import { metadata, task } from "@trigger.dev/sdk/v3";
import { streamText, TextStreamPart } from "ai";

export type STREAMS = {
  claude: TextStreamPart<{}>;
};

export const claudeStream = task({
  id: "claude-stream",
  description: "Stream responses from Claude",
  run: async ({ prompt }: { prompt: string }) => {
    const result = streamText({
      model: anthropic("claude-3-7-sonnet-20250219"),
      // The user's prompt
      prompt: prompt,
      // The system prompt, which is the instruction for the AI
      system: "You are a helpful assistant who responds in a concise manner.",
      providerOptions: {
        anthropic: {
          // Enable thinking to show the AI's reasoning
          thinking: {
            type: "enabled",
            // 1024 is the minimum budget for thinking
            budgetTokens: 1024,
          },
        },
      },
    });

    // This is a stream with all events, including text deltas, tool calls, tool results, and errors.
    // You can use it as either an AsyncIterable or a ReadableStream.
    await metadata.stream("claude", result.fullStream);
  },
});
