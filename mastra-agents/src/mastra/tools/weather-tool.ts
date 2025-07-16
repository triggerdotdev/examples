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
    metadata: z.object({
      timezone: z.string(),
      elevation: z.number(),
      generationTime: z.number(),
    }),
  }),
  execute: async ({ context }) => {
    const { location, days, includeHourly } = context;

    try {
      // Try multiple search formats to find the location
      const searchQueries = [
        location,
        location.replace(", USA", ""),
        location.replace(", US", ""),
        location.split(",")[0].trim(), // Just the city name
      ];

      let geoData = null;
      let searchQuery = "";

      for (const query of searchQueries) {
        console.log(`Trying to geocode: "${query}"`);

        const geoResponse = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${
            encodeURIComponent(query)
          }&count=5&language=en&format=json`,
        );

        if (!geoResponse.ok) {
          console.warn(
            `Geocoding API error for "${query}": ${geoResponse.status}`,
          );
          continue;
        }

        const tempGeoData = await geoResponse.json();

        if (tempGeoData.results && tempGeoData.results.length > 0) {
          geoData = tempGeoData;
          searchQuery = query;
          console.log(
            `Found location for "${query}": ${tempGeoData.results[0].name}, ${
              tempGeoData.results[0].country
            }`,
          );
          break;
        }
      }

      if (!geoData || !geoData.results || geoData.results.length === 0) {
        // List the search attempts for debugging
        const attempts = searchQueries.map((q) => `"${q}"`).join(", ");
        throw new Error(
          `Location not found after trying: ${attempts}. Please try a different city name or include the country (e.g., "London, UK" or "Paris, France").`,
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

      // Process current weather
      const currentWeather = {
        temperature: weatherData.current.temperature_2m,
        feelsLike: weatherData.current.apparent_temperature,
        humidity: weatherData.current.relative_humidity_2m,
        windSpeed: weatherData.current.wind_speed_10m,
        windGusts: weatherData.current.wind_gusts_10m,
        conditions: getWeatherDescription(weatherData.current.weather_code),
        visibility: weatherData.current.visibility,
        uvIndex: weatherData.current.uv_index,
      };

      // Process hourly forecast
      const hourlyForecast = includeHourly && weatherData.hourly
        ? weatherData.hourly.time.slice(0, 24).map((
          time: string,
          index: number,
        ) => ({
          time,
          temperature: weatherData.hourly.temperature_2m[index],
          feelsLike: weatherData.hourly.apparent_temperature[index],
          humidity: weatherData.hourly.relative_humidity_2m[index],
          windSpeed: weatherData.hourly.wind_speed_10m[index],
          windGusts: weatherData.hourly.wind_gusts_10m[index],
          conditions: getWeatherDescription(
            weatherData.hourly.weather_code[index],
          ),
          precipitation: weatherData.hourly.precipitation[index],
          precipitationProbability:
            weatherData.hourly.precipitation_probability[index],
          uvIndex: weatherData.hourly.uv_index[index],
          visibility: weatherData.hourly.visibility[index],
        }))
        : [];

      // Process daily forecast
      const dailyForecast = weatherData.daily.time.map((
        date: string,
        index: number,
      ) => ({
        date,
        maxTemp: weatherData.daily.temperature_2m_max[index],
        minTemp: weatherData.daily.temperature_2m_min[index],
        conditions: getWeatherDescription(
          weatherData.daily.weather_code[index],
        ),
        precipitationSum: weatherData.daily.precipitation_sum[index],
        precipitationProbability:
          weatherData.daily.precipitation_probability_max[index],
        windSpeedMax: weatherData.daily.wind_speed_10m_max[index],
        windGustsMax: weatherData.daily.wind_gusts_10m_max[index],
        uvIndexMax: weatherData.daily.uv_index_max[index],
      }));

      console.log(`Weather data successfully retrieved for ${fullLocation}`);

      return {
        location: fullLocation,
        currentWeather,
        hourlyForecast,
        dailyForecast,
        metadata: {
          timezone: weatherData.timezone,
          elevation: weatherData.elevation,
          generationTime: weatherData.generation_time_ms,
        },
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
