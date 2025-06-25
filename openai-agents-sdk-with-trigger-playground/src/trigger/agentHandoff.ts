import { Agent, handoff, run } from "@openai/agents";
import { logger, task } from "@trigger.dev/sdk";
import { z } from "zod";

// Example payload for testing:
// {
//   "userQuestion": "What is the square root of 144?"
// }

export interface AgentHandoffPayload {
  userQuestion: string;
}

// Define handoff schemas to enable logging
const MathInput = z.object({
  problem: z.string(),
});

const HistoryInput = z.object({
  topic: z.string(),
});

const ScienceInput = z.object({
  subject: z.string(),
});

export const agentHandoff = task({
  id: "agent-handoff",
  maxDuration: 120,
  run: async (payload: AgentHandoffPayload) => {
    logger.info("🎬 Processing user question", {
      question: payload.userQuestion,
    });

    // Create specialist agents
    const mathAgent = new Agent({
      name: "Math Specialist",
      instructions:
        `You are a mathematics expert with strict limitations. You can ONLY:
1. Solve mathematical calculations and equations
2. Explain mathematical concepts
3. Work with numbers and mathematical proofs

You MUST refuse to answer anything that isn't purely mathematical.
If a question involves history (even math history) or science, inform the user that you can only handle mathematical calculations and concepts.`,
      model: "gpt-4o-mini",
    });
    logger.info("📐 Math agent ready");

    const historyAgent = new Agent({
      name: "History Specialist",
      instructions:
        `You are a history expert with strict limitations. You can ONLY:
1. Provide historical dates and timelines
2. Explain historical events and their context
3. Discuss historical figures and periods

You MUST refuse to answer anything that isn't purely historical.
If a question involves calculations or scientific concepts, inform the user that you can only handle historical information.`,
      model: "gpt-4o-mini",
    });
    logger.info("📚 History agent ready");

    const scienceAgent = new Agent({
      name: "Science Specialist",
      instructions:
        `You are a science expert with strict limitations. You can ONLY:
1. Explain scientific concepts and principles
2. Discuss physics, chemistry, and biology topics
3. Describe scientific processes

You MUST refuse to answer anything that isn't purely scientific.
If a question involves historical dates or mathematical calculations, inform the user that you can only handle scientific concepts.`,
      model: "gpt-4o-mini",
    });
    logger.info("🔬 Science agent ready");

    // Create handoff configurations with real-time logging
    let handoffReason = "";
    let handoffSpecialist = "";

    const mathHandoff = handoff(mathAgent, {
      inputType: MathInput,
      toolDescriptionOverride:
        "Transfer ONLY mathematical calculations and concepts - no history or science allowed",
      onHandoff: (ctx, input) => {
        handoffSpecialist = "Math Specialist";
        handoffReason = "Mathematical concepts or calculations required";
        logger.info("📐 Math question handed off to Math Specialist", {
          problem: input?.problem ?? "unknown",
          reason: handoffReason,
        });
      },
    });

    const historyHandoff = handoff(historyAgent, {
      inputType: HistoryInput,
      toolDescriptionOverride:
        "Transfer ONLY historical information and dates - no calculations or science allowed",
      onHandoff: (ctx, input) => {
        handoffSpecialist = "History Specialist";
        handoffReason = "Historical information required";
        logger.info("📚 History question handed off to History Specialist", {
          topic: input?.topic ?? "unknown",
          reason: handoffReason,
        });
      },
    });

    const scienceHandoff = handoff(scienceAgent, {
      inputType: ScienceInput,
      toolDescriptionOverride:
        "Transfer ONLY scientific concepts - no historical dates or calculations allowed",
      onHandoff: (ctx, input) => {
        handoffSpecialist = "Science Specialist";
        handoffReason = "Scientific concepts required";
        logger.info("🔬 Science question handed off to Science Specialist", {
          subject: input?.subject ?? "unknown",
          reason: handoffReason,
        });
      },
    });

    // Create triage agent with handoffs to specialists using Agent.create()
    const triageAgent = Agent.create({
      name: "Triage Agent",
      instructions:
        `You are a triage agent that routes questions to the right specialist. Keep it simple:

Math Specialist: For calculations and math concepts
History Specialist: For dates and historical events
Science Specialist: For scientific concepts

Just give the direct answer to the question. No explanations about why you chose the specialist.`,
      model: "gpt-4o-mini",
      handoffs: [mathHandoff, historyHandoff, scienceHandoff],
    });

    logger.info("🎯 Triaging question through triage agent...", {
      question: payload.userQuestion,
    });

    // Run the triage agent - it will decide whether to handle the question itself or hand off
    const result = await run(triageAgent, payload.userQuestion);

    logger.info("✨ Response generated", {
      question: payload.userQuestion,
      answer: result.finalOutput,
      specialist: handoffSpecialist,
      reason: handoffReason,
    });

    return {
      question: payload.userQuestion,
      answer: result.finalOutput,
      specialist: handoffSpecialist || "No specialist used",
      reason: handoffReason || "No specialist was used",
    };
  },
});
