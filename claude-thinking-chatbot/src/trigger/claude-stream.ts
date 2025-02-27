import { anthropic } from "@ai-sdk/anthropic";
import { metadata, task } from "@trigger.dev/sdk/v3";
import { streamText } from "ai";

export type STREAMS = {
  text: string;
  reasoning: string;
};

export const claudeStream = task({
  id: "claude-stream",
  description: "Stream responses from Claude",
  run: async ({ prompt }: { prompt: string }) => {
    const result = streamText({
      model: anthropic("claude-3-7-sonnet-20250219"),
      // This is the prompt, which is the user's question
      prompt: prompt,
      system: "You are a helpful assistant who responds in a concise manner.",

      providerOptions: {
        anthropic: {
          thinking: {
            type: "enabled",
            // 1024 is the minimum budget for thinking
            budgetTokens: 1024,
          },
        },
      },
    });

    // Create transformed streams that only emit the text content
    const textStream = await metadata.stream(
      "text",
      async function* () {
        for await (const chunk of result.fullStream) {
          if (chunk.type === "text-delta") {
            yield chunk.textDelta;
          }
        }
      }(),
    );

    const reasoningStream = await metadata.stream(
      "reasoning",
      async function* () {
        for await (const chunk of result.fullStream) {
          if (chunk.type === "reasoning") {
            yield chunk.textDelta;
          }
        }
      }(),
    );

    return {
      claude: textStream,
      reasoning: reasoningStream,
    };
  },
});
