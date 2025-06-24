import {
  Agent,
  InputGuardrail,
  InputGuardrailTripwireTriggered,
  run,
} from "@openai/agents";
import { logger, task } from "@trigger.dev/sdk";
import { z } from "zod";

// Example payload for testing:
// {
//   "userInput": "Hello, can you help me solve for x: 2x + 3 = 11?"
// }

export interface GuardrailsPayload {
  userInput: string;
}

// Math homework validation schema
const MathHomeworkSchema = z.object({
  isMathHomework: z.boolean(),
  reasoning: z.string(),
});

// Guardrail agent to check for math homework
const guardrailAgent = new Agent({
  name: "Math Homework Check",
  instructions:
    "Check if the user is asking you to do their math homework. Look for requests to solve equations, do calculations, or complete math assignments.",
  outputType: MathHomeworkSchema,
  model: "gpt-4o-mini", // Fast and efficient for classification tasks
});

const ScienceHomeworkSchema = z.object({
  isScienceHomework: z.boolean(),
  reasoning: z.string(),
});

const scienceGuardrailAgent = new Agent({
  name: "Science Homework Check",
  instructions:
    "Check if the user is asking you to do their science homework. Look for requests to solve equations, do calculations, or complete science assignments.",
  outputType: ScienceHomeworkSchema,
});

// Math homework guardrail
const mathGuardrail: InputGuardrail = {
  name: "Math Homework Guardrail",
  execute: async ({ input, context }) => {
    const result = await run(guardrailAgent, input, { context });
    return {
      outputInfo: result.finalOutput,
      tripwireTriggered: result.finalOutput?.isMathHomework ?? false,
    };
  },
};

const scienceGuardrail: InputGuardrail = {
  name: "Science Homework Guardrail",
  execute: async ({ input, context }) => {
    const result = await run(scienceGuardrailAgent, input, { context });
    return {
      outputInfo: result.finalOutput,
      tripwireTriggered: result.finalOutput?.isScienceHomework ?? false,
    };
  },
};

export const agentWithGuardrails = task({
  id: "agent-with-guardrails",
  maxDuration: 90,
  run: async (payload: GuardrailsPayload) => {
    logger.info("Starting agent with guardrails", {
      input: payload.userInput,
    });

    try {
      // Create agent with single input guardrail
      const agent = new Agent({
        name: "Customer Support Agent",
        instructions:
          "You are a customer support agent. You help customers with their questions.",
        inputGuardrails: [mathGuardrail],
        model: "gpt-4o-mini", // Best for customer support conversations
      });

      // Run the agent - guardrail will automatically execute
      const result = await run(agent, payload.userInput);
      const agentResponse = result.finalOutput || "";

      logger.info("Agent completed successfully", {
        guardrailModel: "gpt-4o-mini",
        mainAgentModel: "gpt-4o-mini",
      });

      return {
        success: true,
        userInput: payload.userInput,
        response: agentResponse,
        modelsUsed: {
          guardrail: "gpt-4o-mini",
          mainAgent: "gpt-4o-mini",
        },
      };
    } catch (error) {
      if (error instanceof InputGuardrailTripwireTriggered) {
        logger.warn("Math homework guardrail triggered", {
          input: payload.userInput,
        });

        return {
          success: false,
          reason: "Math homework detected",
          userInput: payload.userInput,
          response: "Math homework guardrail tripped",
          modelsUsed: {
            guardrail: "gpt-4o-mini",
            mainAgent: "not_executed",
          },
        };
      }

      // Handle other errors
      logger.error("Unexpected error in agent execution", { error });
      throw error;
    }
  },
});
