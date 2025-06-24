import { Agent, run } from "@openai/agents";
import { logger, schedules } from "@trigger.dev/sdk";

// This task runs on schedule, but can also be triggered manually with payload:
// {
//   "focusArea": "AI",
//   "industryContext": "healthcare"
// }

export interface TrendAnalysisPayload {
  focusArea?: "AI" | "web3" | "sustainability" | "cybersecurity" | "general";
  industryContext?: string;
}

export const scheduledAgent = schedules.task({
  id: "scheduled-agent-check",
  // Run every 6 hours
  cron: "0 */6 * * *",
  run: async (payload) => {
    logger.info("Starting scheduled agent check", {
      scheduledAt: payload.timestamp,
      timezone: payload.timezone,
    });

    // Use default values for scheduled runs
    const focusArea = "general";
    const industryContext = undefined;

    // Create an agent that analyzes current tech trends
    const agent = new Agent({
      name: "Trend Analyst",
      instructions:
        `You are a tech trend analyst specializing in ${focusArea} trends. 
      Provide a brief analysis of current technology trends. 
      ${
          industryContext
            ? `Focus specifically on the ${industryContext} industry.`
            : ""
        }
      Keep your response concise but insightful - around 2-3 sentences.`,
    });

    // Ask the agent for current insights
    const prompt =
      `What are the most significant ${focusArea} technology trends happening right now in ${
        new Date().toLocaleDateString()
      }? 
    ${
        industryContext
          ? `Focus on implications for the ${industryContext} industry.`
          : "Focus on developments that would interest software developers and technology professionals."
      }`;

    const result = await run(agent, prompt);

    logger.info("Scheduled agent analysis completed", {
      analysisLength: result.finalOutput?.length || 0,
      focusArea,
      industryContext,
      timestamp: new Date().toISOString(),
    });

    return {
      timestamp: payload.timestamp,
      scheduleId: payload.scheduleId,
      timezone: payload.timezone,
      analysis: result.finalOutput,
      agentName: agent.name,
      focusArea,
      industryContext,
      nextRun: payload.upcoming[0], // Next scheduled run
    };
  },
});
