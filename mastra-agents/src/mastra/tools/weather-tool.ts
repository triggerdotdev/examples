import { Tool } from "@mastra/core/tools";
import { z } from "zod";

const weatherInputSchema = z.object({
  location: z.string().describe("The city and country to get weather for"),
  days: z.number().min(1).max(7).default(1).describe(
    "Number of days to forecast",
  ),
  includeHourly: z.boolean().default(true).describe(
    "Include hourly forecast data",
  ),
});

export const weatherTool = new Tool({
  id: "weather-tool",
  description:
    "Get detailed weather forecast including hourly data for temperature, precipitation, and conditions",
  inputSchema: weatherInputSchema,
  outputSchema: z.object({
    location: z.string(),
    current: z.object({
      temperature: z.number(),
      feelsLike: z.number(),
      windSpeed: z.number(),
      conditions: z.string(),
      uvIndex: z.number(),
      rainChance: z.number().optional(),
    }),
    today: z.object({
      maxTemp: z.number(),
      minTemp: z.number(),
      conditions: z.string(),
      rainChance: z.number(),
      maxWindSpeed: z.number(),
      maxUvIndex: z.number(),
    }),
    hourlyHighlights: z.array(z.object({
      time: z.string(),
      temperature: z.number(),
      conditions: z.string(),
      rainChance: z.number(),
    })).optional(),
  }),
  execute: async ({ context }) => {
    const { location, days, includeHourly } = context;

    try {
      // Try original location first, then fallback to city name only
      const attempts = [
        location,
        location.split(",")[0].trim(), // Just the city name
      ];

      let geoData = null;

      for (const attempt of attempts) {
        console.log(`Geocoding: "${attempt}"`);

        const geoResponse = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${
            encodeURIComponent(attempt)
          }&count=1&language=en&format=json`,
        );

        if (!geoResponse.ok) {
          console.warn(
            `Geocoding API error for "${attempt}": ${geoResponse.status}`,
          );
          continue;
        }

        const tempGeoData = await geoResponse.json();

        if (tempGeoData.results && tempGeoData.results.length > 0) {
          geoData = tempGeoData;
          console.log(
            `Found location: ${geoData.results[0].name}, ${
              geoData.results[0].country
            }`,
          );
          break;
        }
      }

      if (!geoData || !geoData.results || geoData.results.length === 0) {
        throw new Error(
          `Location "${location}" not found. Please try a different city name.`,
        );
      }

      const { latitude, longitude, name, country, timezone } =
        geoData.results[0];
      const fullLocation = `${name}, ${country}`;

      console.log(
        `Successfully geocoded "${location}" to ${fullLocation} (${latitude}, ${longitude})`,
      );

      // Build weather API URL with detailed parameters
      const weatherParams = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        current: [
          "temperature_2m",
          "apparent_temperature",
          "relative_humidity_2m",
          "weather_code",
          "wind_speed_10m",
          "wind_gusts_10m",
          "visibility",
          "uv_index",
        ].join(","),
        daily: [
          "temperature_2m_max",
          "temperature_2m_min",
          "weather_code",
          "precipitation_sum",
          "precipitation_probability_max",
          "wind_speed_10m_max",
          "wind_gusts_10m_max",
          "uv_index_max",
        ].join(","),
        timezone: "auto",
        forecast_days: days.toString(),
      });

      // Add hourly data if requested
      if (includeHourly) {
        weatherParams.append(
          "hourly",
          [
            "temperature_2m",
            "apparent_temperature",
            "relative_humidity_2m",
            "weather_code",
            "wind_speed_10m",
            "wind_gusts_10m",
            "precipitation",
            "precipitation_probability",
            "uv_index",
            "visibility",
          ].join(","),
        );
      }

      const weatherResponse = await fetch(
        `https://api.open-meteo.com/v1/forecast?${weatherParams}`,
      );

      if (!weatherResponse.ok) {
        throw new Error(
          `Weather API error: ${weatherResponse.status} - ${weatherResponse.statusText}`,
        );
      }

      const weatherData = await weatherResponse.json();

      // Check if we got valid weather data
      if (!weatherData.current) {
        throw new Error("Invalid weather data received from API");
      }

      // Weather code mapping
      const getWeatherDescription = (code: number): string => {
        const weatherCodes: { [key: number]: string } = {
          0: "Clear sky",
          1: "Mainly clear",
          2: "Partly cloudy",
          3: "Overcast",
          45: "Fog",
          48: "Depositing rime fog",
          51: "Light drizzle",
          53: "Moderate drizzle",
          55: "Dense drizzle",
          56: "Light freezing drizzle",
          57: "Dense freezing drizzle",
          61: "Slight rain",
          63: "Moderate rain",
          65: "Heavy rain",
          66: "Light freezing rain",
          67: "Heavy freezing rain",
          71: "Slight snow fall",
          73: "Moderate snow fall",
          75: "Heavy snow fall",
          77: "Snow grains",
          80: "Slight rain showers",
          81: "Moderate rain showers",
          82: "Violent rain showers",
          85: "Slight snow showers",
          86: "Heavy snow showers",
          95: "Slight thunderstorm",
          96: "Thunderstorm with slight hail",
          99: "Thunderstorm with heavy hail",
        };
        return weatherCodes[code] || "Unknown";
      };

      // Process current weather - simplified for clothing recommendations
      const current = {
        temperature: weatherData.current.temperature_2m,
        feelsLike: weatherData.current.apparent_temperature,
        windSpeed: weatherData.current.wind_speed_10m,
        conditions: getWeatherDescription(weatherData.current.weather_code),
        uvIndex: weatherData.current.uv_index,
      };

      // Process today's forecast - just the essentials
      const today = {
        maxTemp: weatherData.daily.temperature_2m_max[0],
        minTemp: weatherData.daily.temperature_2m_min[0],
        conditions: getWeatherDescription(weatherData.daily.weather_code[0]),
        rainChance: weatherData.daily.precipitation_probability_max[0] || 0,
        maxWindSpeed: weatherData.daily.wind_speed_10m_max[0],
        maxUvIndex: weatherData.daily.uv_index_max[0],
      };

      // Optional: key hourly highlights for next 8 hours
      const hourlyHighlights = includeHourly && weatherData.hourly
        ? weatherData.hourly.time.slice(0, 8).map((
          time: string,
          index: number,
        ) => ({
          time,
          temperature: weatherData.hourly.temperature_2m[index],
          conditions: getWeatherDescription(
            weatherData.hourly.weather_code[index],
          ),
          rainChance: weatherData.hourly.precipitation_probability[index] || 0,
        }))
        : undefined;

      console.log(`Weather data successfully retrieved for ${fullLocation}`);

      return {
        location: fullLocation,
        current,
        today,
        hourlyHighlights,
      };
    } catch (error) {
      console.error("Weather API call failed:", error);
      throw new Error(
        `Weather API call failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  },
});
