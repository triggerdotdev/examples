import { Agent, handoff, run } from "@openai/agents";
import { logger, task } from "@trigger.dev/sdk";
import { z } from "zod";

// Example payload for testing:
// {
//   "userQuestion": "What is the square root of 144 and when was calculus invented?"
// }

export interface AgentHandoffPayload {
  userQuestion: string;
}

// Define handoff input schemas
const MathHandoffData = z.object({
  problem: z.string().describe("The math problem to solve"),
  complexity: z.enum(["basic", "intermediate", "advanced"]).nullable().describe(
    "The complexity level of the math problem",
  ),
});

const HistoryHandoffData = z.object({
  topic: z.string().describe("The historical topic or question"),
  timeFrame: z.string().nullable().describe("Specific time period if relevant"),
});

const ScienceHandoffData = z.object({
  subject: z.string().describe("The scientific subject or question"),
  fieldOfScience: z.enum(["physics", "chemistry", "biology", "general"])
    .nullable().describe("The specific field of science"),
});

type MathHandoffData = z.infer<typeof MathHandoffData>;
type HistoryHandoffData = z.infer<typeof HistoryHandoffData>;
type ScienceHandoffData = z.infer<typeof ScienceHandoffData>;

export const agentHandoffExample = task({
  id: "agent-handoff-example",
  maxDuration: 120,
  run: async (payload: AgentHandoffPayload) => {
    logger.info("Starting agent handoff example", {
      question: payload.userQuestion,
    });

    // Create specialist agents
    const mathAgent = new Agent<MathHandoffData>({
      name: "Math Specialist",
      instructions: `You are a mathematics expert. When you receive a handoff:
1. Solve math problems step by step with clear explanations
2. Show your work and provide examples when helpful
3. If the problem involves multiple disciplines, explain the mathematical aspects thoroughly
4. Always be precise with calculations and formulas`,
      model: "gpt-4o-mini",
    });

    const historyAgent = new Agent<HistoryHandoffData>({
      name: "History Specialist",
      instructions: `You are a history expert. When you receive a handoff:
1. Provide detailed historical context and accurate information
2. Include relevant dates and background information
3. Explain the significance of historical events or figures
4. If the topic spans multiple time periods, organize your response chronologically`,
      model: "gpt-4o-mini",
    });

    const scienceAgent = new Agent<ScienceHandoffData>({
      name: "Science Specialist",
      instructions: `You are a science expert. When you receive a handoff:
1. Explain scientific concepts clearly with examples
2. Provide real-world applications when relevant
3. Break down complex topics into understandable parts
4. Include the underlying scientific principles`,
      model: "gpt-4o-mini",
    });

    // Create handoff configurations with callbacks
    const mathHandoff = handoff(mathAgent, {
      inputType: MathHandoffData,
      toolDescriptionOverride:
        "Transfer to math specialist for mathematical calculations, equations, or quantitative problems",
      onHandoff: (ctx, input) => {
        logger.info("Transferring to Math Specialist", {
          problem: input?.problem,
          complexity: input?.complexity,
        });
      },
    });

    const historyHandoff = handoff(historyAgent, {
      inputType: HistoryHandoffData,
      toolDescriptionOverride:
        "Transfer to history specialist for historical events, dates, figures, or periods",
      onHandoff: (ctx, input) => {
        logger.info("Transferring to History Specialist", {
          topic: input?.topic,
          timeFrame: input?.timeFrame,
        });
      },
    });

    const scienceHandoff = handoff(scienceAgent, {
      inputType: ScienceHandoffData,
      toolDescriptionOverride:
        "Transfer to science specialist for physics, chemistry, biology, or general scientific concepts",
      onHandoff: (ctx, input) => {
        logger.info("Transferring to Science Specialist", {
          subject: input?.subject,
          fieldOfScience: input?.fieldOfScience,
        });
      },
    });

    // Create triage agent with handoffs to specialists
    const triageAgent = Agent.create({
      name: "Triage Agent",
      instructions:
        `You are a helpful triage agent that routes questions to appropriate specialists.

Analyze the user's question and determine if it requires specialized knowledge:
- For mathematical problems, calculations, equations, or numerical analysis: transfer to the Math Specialist
- For historical events, dates, historical figures, or time periods: transfer to the History Specialist  
- For scientific concepts, physics, chemistry, biology, or scientific principles: transfer to the Science Specialist

If a question involves multiple disciplines, choose the most relevant specialist or handle it yourself if it's general knowledge.

Always be helpful and explain your reasoning when transferring to a specialist.`,
      model: "gpt-4o-mini",
      handoffs: [mathHandoff, historyHandoff, scienceHandoff],
    });

    // Run the triage agent - it will decide whether to handle the question itself or hand off
    const result = await run(triageAgent, payload.userQuestion);

    logger.info("Agent handoff example completed", {
      question: payload.userQuestion,
      finalOutput: result.finalOutput,
    });

    return {
      userQuestion: payload.userQuestion,
      response: result.finalOutput,
      // Include the full result object for debugging and additional info
      // runResult: result,
    };
  },
});
