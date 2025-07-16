import { logger, task } from "@trigger.dev/sdk/v3";
import { mastra } from "../mastra";

export const cityDayPlannerTask = task({
  id: "city-day-planner",
  maxDuration: 300,
  run: async (payload: { location: string; structured?: boolean }, { ctx }) => {
    logger.info(`🌍 Starting day planner for ${payload.location}`, {
      location: payload.location,
      taskId: ctx.task.id,
      runId: ctx.run.id,
    });

    try {
      const startTime = Date.now();

      // Use task run ID as threadId for memory sharing between tasks
      const threadId = ctx.run.id;

      // First analyze the weather and store in memory
      logger.info(
        `🔄 Step 1: Analyzing weather in ${payload.location} and storing in memory`,
        {
          location: payload.location,
          threadId,
        },
      );

      const weatherResult = await weatherAnalysisTask.triggerAndWait({
        location: payload.location,
      });

      if (!weatherResult.ok) {
        throw new Error(`Weather analysis failed: ${weatherResult.error}`);
      }

      logger.info(
        `🔄 Step 2: Creating day plan using memory data`,
        {
          location: payload.location,
          threadId: weatherResult.output.threadId,
        },
      );

      // Then create the day plan using the same threadId to access memory
      const planResult = await activityPlannerTask.triggerAndWait({
        location: payload.location,
        threadId: weatherResult.output.threadId, // Use same threadId to share memory
      });

      if (!planResult.ok) {
        throw new Error(`Day planning failed: ${planResult.error}`);
      }

      const totalTime = Date.now() - startTime;

      logger.info(`✅ Day planner completed for ${payload.location}`, {
        location: payload.location,
        totalProcessingTimeMs: totalTime,
        weatherAnalysisLength: weatherResult.output.weatherAnalysis?.length ||
          0,
        dayPlanLength: planResult.output.dayPlan?.length || 0,
        sharedThreadId: weatherResult.output.threadId,
        structured: payload.structured || false,
      });

      const result: any = {
        success: true,
        location: payload.location,
        weatherAnalysis: weatherResult.output.weatherAnalysis,
        dayPlan: planResult.output.dayPlan,
        threadId: weatherResult.output.threadId,
        metadata: {
          totalProcessingTimeMs: totalTime,
          weatherMetadata: weatherResult.output.metadata,
          planMetadata: planResult.output.metadata,
          memoryShared: true, // Flag to indicate memory was used
        },
        timestamp: new Date().toISOString(),
      };

      // Add structured weather data if requested
      if (payload.structured) {
        // The structured weather data is available through the weather tool
        // which was called by the weather analyst agent
        result.structuredDataNote =
          "Structured weather data is available through the weather tool output in the agent's execution steps. Access via agent.steps or use the weather tool directly for structured output.";
      }

      return result;
    } catch (error) {
      logger.error("❌ City day planner failed", {
        location: payload.location,
        error: error instanceof Error ? error.message : "Unknown error",
        errorStack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        location: payload.location,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  },
});

export const weatherAnalysisTask = task({
  id: "weather-analysis",
  maxDuration: 300,
  run: async (payload: { location: string; structured?: boolean }, { ctx }) => {
    logger.info(`🌤️ Starting weather analysis for ${payload.location}`, {
      location: payload.location,
      taskId: ctx.task.id,
      runId: ctx.run.id,
    });

    try {
      const weatherAnalyst = mastra.getAgent("weatherAnalyst");
      const startTime = Date.now();

      // Use task run ID as threadId for memory sharing
      const threadId = ctx.run.id;

      logger.info("🤖 Using weather analyst with memory", {
        agentName: weatherAnalyst.name,
        location: payload.location,
        threadId,
      });

      const response = await weatherAnalyst.generate(
        `Please analyze the weather for ${payload.location} including current conditions, hourly forecasts for the next 24 hours, and daily forecasts. Store all weather data in working memory so other agents can access it. Focus on conditions that matter for daily planning: temperature changes, precipitation, wind, UV index, and visibility.`,
        {
          maxSteps: 3,
          threadId,
          resourceId: payload.location, // Use location as resourceId for consistency
        },
      );

      // Extract structured weather data from the response steps if requested
      let structuredWeatherData = null;
      if (payload.structured && response.steps) {
        for (const step of response.steps) {
          if (step.toolResults) {
            for (const toolResult of step.toolResults) {
              if (toolResult.toolName === "weatherTool" && toolResult.result) {
                structuredWeatherData = toolResult.result;
                break;
              }
            }
          }
          if (structuredWeatherData) break;
        }
      }

      const processingTime = Date.now() - startTime;

      logger.info("✅ Weather analysis completed and stored in memory", {
        location: payload.location,
        processingTimeMs: processingTime,
        responseLength: response.text.length,
        steps: response.steps?.length || 0,
        threadId,
      });

      const result: any = {
        success: true,
        location: payload.location,
        weatherAnalysis: response.text,
        threadId, // Return threadId for chaining
        metadata: {
          processingTimeMs: processingTime,
          steps: response.steps?.length || 0,
          tokenUsage: response.usage,
        },
        timestamp: new Date().toISOString(),
      };

      // Add structured weather data if requested and available
      if (payload.structured && structuredWeatherData) {
        result.structuredWeatherData = structuredWeatherData;
      }

      return result;
    } catch (error) {
      logger.error("❌ Weather analysis failed", {
        location: payload.location,
        error: error instanceof Error ? error.message : "Unknown error",
        errorStack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        location: payload.location,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  },
});

export const activityPlannerTask = task({
  id: "activity-planner",
  maxDuration: 300,
  run: async (payload: { location: string; threadId?: string }, { ctx }) => {
    logger.info("🎯 Starting activity planning", {
      location: payload.location,
      threadId: payload.threadId,
      taskId: ctx.task.id,
      runId: ctx.run.id,
    });

    try {
      const dayPlannerAgent = mastra.getAgent("dayPlannerAgent");
      const startTime = Date.now();

      // Use provided threadId or fallback to run ID
      const threadId = payload.threadId || ctx.run.id;

      logger.info("🤖 Using day planner agent with memory", {
        agentName: dayPlannerAgent.name,
        location: payload.location,
        threadId,
      });

      const response = await dayPlannerAgent.generate(
        `Please create a weather-aware day plan for ${payload.location}. First check working memory for weather data. If weather data is available in memory, use that data to create a structured day plan. Only call the weather tool if no data is available in memory. Include activities for morning, afternoon, and evening with specific timing, weather conditions at each time, explanations for why each activity works with the weather, and what to bring. Also include backup indoor plans.`,
        {
          maxSteps: 3,
          threadId,
          resourceId: payload.location, // Use location as resourceId for consistency
        },
      );

      const processingTime = Date.now() - startTime;

      logger.info("✅ Day plan created using memory data", {
        location: payload.location,
        processingTimeMs: processingTime,
        responseLength: response.text.length,
        steps: response.steps?.length || 0,
        threadId,
      });

      return {
        success: true,
        location: payload.location,
        dayPlan: response.text,
        threadId, // Return threadId for reference
        metadata: {
          processingTimeMs: processingTime,
          steps: response.steps?.length || 0,
          tokenUsage: response.usage,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("❌ Day planning failed", {
        location: payload.location,
        error: error instanceof Error ? error.message : "Unknown error",
        errorStack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        location: payload.location,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  },
});
