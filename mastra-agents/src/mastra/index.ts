import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";
import { weatherAnalyst } from "./agents/weather-analyst";
import { clothingAdvisorAgent } from "./agents/clothing-advisor";

export const mastra: Mastra = new Mastra({
  storage: new PostgresStore({
    connectionString: process.env.DATABASE_URL!,
  }),
  agents: {
    weatherAnalyst,
    clothingAdvisorAgent,
  },
});
