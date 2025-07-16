import { logger, task } from "@trigger.dev/sdk";
import { mastra } from "../mastra";

export const whatShouldIWearTodayTask = task({
  id: "what-should-i-wear-today",
  maxDuration: 15,
  run: async (payload: { city: string; activity?: string }, { ctx }) => {
    const activity = payload.activity || "walking";

    logger.info(
      `👕 What should I wear today for ${activity} in ${payload.city}`,
      {
        city: payload.city,
        activity,
        taskId: ctx.task.id,
        runId: ctx.run.id,
      },
    );

    try {
      const startTime = Date.now();
      const threadId = ctx.run.id;

      // Step 1: Get simplified weather data and store in memory
      logger.info("🌤️ Getting weather data", {
        city: payload.city,
        threadId,
      });

      const weatherResult = await weatherDataTask.triggerAndWait({
        city: payload.city,
      });

      if (!weatherResult.ok) {
        throw new Error(`Weather data failed: ${weatherResult.error}`);
      }

      // Step 2: Get clothing recommendation from memory
      logger.info("👔 Getting clothing recommendation", {
        city: payload.city,
        activity,
        threadId: weatherResult.output.threadId,
      });

      const clothingResult = await clothingAdviceTask.triggerAndWait({
        city: payload.city,
        activity,
        threadId: weatherResult.output.threadId,
      });

      logger.info("🔍 Clothing result debug", {
        ok: clothingResult.ok,
        output: clothingResult.ok ? clothingResult.output : null,
        error: clothingResult.ok ? null : clothingResult.error,
      });

      if (!clothingResult.ok) {
        throw new Error(`Clothing advice failed: ${clothingResult.error}`);
      }

      const totalTime = Date.now() - startTime;

      logger.info(
        `✅ Completed clothing recommendation for ${activity} in ${payload.city}`,
        {
          city: payload.city,
          activity,
          totalProcessingTimeMs: totalTime,
          finalAdvice: clothingResult.output.advice,
          hasAdvice: !!clothingResult.output.advice,
        },
      );

      return clothingResult.output.advice || "No clothing advice generated";
    } catch (error) {
      logger.error("❌ What should I wear today task failed", {
        city: payload.city,
        activity,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      throw error;
    }
  },
});

export const weatherDataTask = task({
  id: "weather-data",
  maxDuration: 10,
  run: async (payload: { city: string }, { ctx }) => {
    logger.info(`🌤️ Getting weather data for ${payload.city}`, {
      city: payload.city,
      taskId: ctx.task.id,
    });

    try {
      const weatherAnalyst = mastra.getAgent("weatherAnalyst");
      const startTime = Date.now();
      const threadId = ctx.run.id;

      const response = await weatherAnalyst.generate(
        `Get current weather for ${payload.city}. Use the weather tool to get the data, then store ONLY these 4 fields in working memory:
- location: "${payload.city}"
- temperature: the current temperature from the tool
- rainChance: the rain chance from today's forecast
- windSpeed: the current wind speed

You MUST store this data in working memory so other agents can access it. After storing, confirm what you stored.`,
        {
          maxSteps: 2,
          threadId,
          resourceId: payload.city,
        },
      );

      // Extract structured weather data from weatherTool result
      let weatherData = null;
      if (response.steps) {
        for (const step of response.steps) {
          if (step.toolResults) {
            for (const toolResult of step.toolResults) {
              if (toolResult.toolName === "weatherTool" && toolResult.result) {
                weatherData = toolResult.result;
                break;
              }
            }
          }
          if (weatherData) break;
        }
      }

      const processingTime = Date.now() - startTime;

      logger.info("✅ Weather data retrieved", {
        city: payload.city,
        processingTimeMs: processingTime,
        hasStructuredData: !!weatherData,
        weatherData: weatherData,
        responseText: response.text,
        stepsCount: response.steps?.length || 0,
      });

      return {
        success: true,
        city: payload.city,
        weatherData,
        threadId,
        metadata: {
          processingTimeMs: processingTime,
          hasStructuredData: !!weatherData,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("❌ Weather data task failed", {
        city: payload.city,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        success: false,
        city: payload.city,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  },
});

export const clothingAdviceTask = task({
  id: "clothing-advice",
  maxDuration: 10,
  run: async (
    payload: { city: string; activity: string; threadId?: string },
    { ctx },
  ) => {
    logger.info("👔 Getting clothing advice", {
      city: payload.city,
      activity: payload.activity,
      taskId: ctx.task.id,
    });

    try {
      const clothingAgent = mastra.getAgent("clothingAdvisorAgent");
      const startTime = Date.now();
      const threadId = payload.threadId || ctx.run.id;

      const response = await clothingAgent.generate(
        `You must provide clothing advice for ${payload.activity} in ${payload.city}. 

First, check your working memory for weather data for ${payload.city}. The data should contain: location, temperature, rainChance, windSpeed.

If you find the weather data in memory, use it. If not, you can use the weather tool.

Based on the weather conditions, provide exactly one paragraph starting with "For ${payload.activity} in ${payload.city} you should wear..." and explain why based on the specific weather conditions.

You MUST provide a response. Do not return empty or blank responses.`,
        {
          maxSteps: 2,
          threadId,
          resourceId: payload.city,
        },
      );

      const processingTime = Date.now() - startTime;

      logger.info("✅ Clothing advice generated", {
        city: payload.city,
        activity: payload.activity,
        processingTimeMs: processingTime,
        responseLength: response.text.length,
        responseText: response.text,
        hasResponse: !!response.text,
      });

      return {
        success: true,
        city: payload.city,
        activity: payload.activity,
        advice: response.text || "No advice generated",
        threadId,
        metadata: {
          processingTimeMs: processingTime,
          responseLength: response.text.length,
          hasResponse: !!response.text,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("❌ Clothing advice task failed", {
        city: payload.city,
        activity: payload.activity,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        success: false,
        city: payload.city,
        activity: payload.activity,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  },
});
