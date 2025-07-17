import { Agent } from "@mastra/core";
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";
import { weatherTool } from "../tools/weather-tool";
import { WeatherDataSchema } from "../schemas/weather-data";

export const weatherAnalyst = new Agent({
  name: "Weather Analyst",
  instructions: `You are a weather analyst. Your job is to:
1. Get current weather data for requested locations using the weather tool
2. Extract and store simplified weather data in working memory for other agents to use
3. Transform the weather tool output into the simplified format

When analyzing weather data:
- Use the weather tool to get current conditions
- The tool returns an object with "current" and "today" properties
- Extract these specific values:
  - temperature: use current.temperature 
  - rainChance: use today.rainChance
  - windSpeed: use current.windSpeed
- Store this simplified data in working memory with the location

IMPORTANT: The weather tool returns a complex object, but you must store only these 4 fields in working memory:
- location: the location string from the tool
- temperature: current.temperature (in Celsius)
- rainChance: today.rainChance (percentage 0-100)
- windSpeed: current.windSpeed (km/h)

Example: If weather tool returns {location: "London", current: {temperature: 15, windSpeed: 20}, today: {rainChance: 40}}, store {location: "London", temperature: 15, rainChance: 40, windSpeed: 20}`,
  model: openai("gpt-4o"),
  tools: { weatherTool },
  memory: new Memory({
    options: {
      workingMemory: {
        enabled: true,
        schema: WeatherDataSchema,
        scope: "thread",
      },
    },
  }),
});
