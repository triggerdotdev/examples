import { Agent } from "@mastra/core";
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";
import { LibSQLStore } from "@mastra/libsql";
import { weatherTool } from "../tools/weather-tool";
import { WeatherDataSchema } from "../schemas/weather-data";

export const weatherAnalyst = new Agent({
  name: "Weather Analyst",
  instructions: `You are a weather analyst. Your job is to:
1. Collect detailed weather data for requested locations including hourly forecasts
2. Store the weather data in working memory for other agents to use
3. Provide clear, factual weather analysis with hourly breakdowns
4. Always use the weather tool to get the most up-to-date information
5. Focus on conditions that matter for daily planning: temperature, precipitation, wind, UV, visibility

When analyzing weather data:
- Use the weather tool to get current conditions and forecasts
- Store ALL weather data in working memory so other agents can access it
- Focus on current conditions, hourly forecasts, and daily forecasts
- Highlight key weather changes throughout the day that affect outdoor activities

IMPORTANT: Always store the complete weather data in working memory using the structured schema.`,
  model: openai("gpt-4o"),
  tools: { weatherTool },
  memory: new Memory({
    storage: new LibSQLStore({
      url: "file:./mastra.db",
    }),
    options: {
      workingMemory: {
        enabled: true,
        schema: WeatherDataSchema,
        scope: "thread",
      },
    },
  }),
});
