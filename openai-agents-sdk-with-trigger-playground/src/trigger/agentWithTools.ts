import { Agent, run, tool } from "@openai/agents";
import { logger, task } from "@trigger.dev/sdk";
import { z } from "zod";

// Example payload for testing:
// {
//   "question": "What's the weather like in London?"
// }

export interface WeatherQueryPayload {
  question: string;
}

const getWeatherTool = tool({
  name: "get_weather",
  description: "Get the weather for a given city",
  parameters: z.object({ city: z.string() }),
  async execute({ city }) {
    return `The weather in ${city} is sunny.`;
  },
});

export const agentWithTools = task({
  id: "agent-with-tools",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },
  run: async (payload: WeatherQueryPayload) => {
    logger.info("Starting agent with tools", {
      question: payload.question,
    });

    // Create agent with the simple weather tool
    const agent = new Agent({
      name: "Weather Assistant",
      instructions:
        `You are a helpful weather assistant. Use the get_weather tool to provide weather information for cities that users ask about.`,
      tools: [getWeatherTool],
    });

    try {
      // Run the agent with the user's question
      const result = await run(agent, payload.question, {
        maxTurns: 5,
      });

      const response = result.finalOutput ||
        "I couldn't process your weather request.";

      logger.info("Agent completed successfully", {
        response: response.substring(0, 100) + "...",
        resultLength: response.length,
      });

      return {
        question: payload.question,
        response,
        metadata: {
          timestamp: new Date().toISOString(),
          agentName: agent.name,
          responseLength: response.length,
        },
      };
    } catch (error) {
      logger.error("Agent execution failed", {
        error: error instanceof Error ? error.message : String(error),
        question: payload.question,
      });

      throw new Error(
        `Weather agent failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  },
});
