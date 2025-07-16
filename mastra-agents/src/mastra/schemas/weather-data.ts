import { z } from "zod";

// Shared weather data schema for working memory
export const WeatherDataSchema = z.object({
  location: z.string(),
  lastUpdated: z.string(),
  currentWeather: z.object({
    temperature: z.number(),
    feelsLike: z.number(),
    humidity: z.number(),
    windSpeed: z.number(),
    windGusts: z.number(),
    conditions: z.string(),
    visibility: z.number(),
    uvIndex: z.number(),
  }),
  hourlyForecast: z.array(z.object({
    time: z.string(),
    temperature: z.number(),
    feelsLike: z.number(),
    humidity: z.number(),
    windSpeed: z.number(),
    windGusts: z.number(),
    conditions: z.string(),
    precipitation: z.number(),
    precipitationProbability: z.number(),
    uvIndex: z.number(),
    visibility: z.number(),
  })),
  dailyForecast: z.array(z.object({
    date: z.string(),
    maxTemp: z.number(),
    minTemp: z.number(),
    conditions: z.string(),
    precipitationSum: z.number(),
    precipitationProbability: z.number(),
    windSpeedMax: z.number(),
    windGustsMax: z.number(),
    uvIndexMax: z.number(),
  })),
});

export type WeatherData = z.infer<typeof WeatherDataSchema>;
