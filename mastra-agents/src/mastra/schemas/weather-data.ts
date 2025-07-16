import { z } from "zod";

// Simplified weather data schema for working memory - just the essentials
export const WeatherDataSchema = z.object({
  location: z.string(),
  temperature: z.number(),
  rainChance: z.number(),
  windSpeed: z.number(),
});

export type WeatherData = z.infer<typeof WeatherDataSchema>;
