import { Agent, run } from "@openai/agents";
import { logger, task } from "@trigger.dev/sdk";

// Example payloads for testing:
// {
//   "message": "Explain quantum computing in simple terms",
//   "agentPersonality": "helpful"
// }
// {
//   "message": "Solve this complex math problem: If f(x) = x³ - 2x² + x - 1, find all real roots",
//   "agentPersonality": "reasoning"
// }
// {
//   "message": "Debug this Python code and explain the issue",
//   "agentPersonality": "coding"
// }

export interface BasicChatPayload {
  message: string;
  agentPersonality?:
    | "helpful"
    | "creative"
    | "analytical"
    | "friendly"
    | "reasoning"
    | "coding"
    | "cost_efficient";
}

export const basicAgentChat = task({
  id: "basic-agent-chat",
  maxDuration: 60,
  run: async (payload: BasicChatPayload) => {
    logger.info("Starting basic agent chat", {
      message: payload.message,
      personality: payload.agentPersonality,
    });

    // Define personality-specific configurations
    const personalityConfigs = {
      helpful: {
        instructions:
          "You are a helpful and supportive assistant. Provide clear, practical answers.",
        model: "gpt-4", // Best for following instructions precisely
      },
      creative: {
        instructions:
          "You are a creative and imaginative assistant. Use metaphors and creative examples.",
        model: "gpt-4", // Best for creative writing and storytelling
      },
      analytical: {
        instructions:
          "You are an analytical assistant. Break down complex topics logically and systematically. Think through problems step by step.",
        model: "o1-preview", // Best for complex reasoning, math, and analytical thinking
      },
      friendly: {
        instructions:
          "You are a warm and friendly assistant. Use a conversational, approachable tone.",
        model: "gpt-4", // Good balance for conversational interactions
      },
      reasoning: {
        instructions:
          "You are a reasoning specialist. Take time to think through complex problems step by step. Show your reasoning process.",
        model: "o1-preview", // Optimized for chain-of-thought reasoning
      },
      coding: {
        instructions:
          "You are a coding assistant. Help with programming tasks, debugging, and technical explanations.",
        model: "o1-mini", // Good for coding tasks, more cost-effective than o1-preview
      },
      cost_efficient: {
        instructions:
          "You are a helpful assistant optimized for quick, efficient responses.",
        model: "gpt-4o-mini", // Most cost-effective while still capable
      },
    };

    const selectedPersonality = payload.agentPersonality || "helpful";
    const config = personalityConfigs[selectedPersonality];

    const agent = new Agent({
      name: `${selectedPersonality} Assistant`,
      instructions: config.instructions,
      model: config.model,
    });

    logger.info("Agent created with model", {
      personality: selectedPersonality,
      model: config.model,
    });

    // Run the agent with the user's message
    const result = await run(agent, payload.message);

    logger.info("Agent response generated", {
      inputLength: payload.message.length,
      outputLength: result.finalOutput?.length || 0,
      modelUsed: config.model,
    });

    return {
      userMessage: payload.message,
      agentResponse: result.finalOutput,
      agentName: agent.name,
      personalityUsed: selectedPersonality,
      modelUsed: config.model,
    };
  },
});
