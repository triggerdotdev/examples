import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { weatherAnalyst } from "./agents/weather-analyst";
import { clothingAdvisorAgent } from "./agents/clothing-advisor";

export const mastra: Mastra = new Mastra({
  storage: new LibSQLStore({
    url: "file:./mastra.db",
  }),
  agents: {
    weatherAnalyst,

    clothingAdvisorAgent,
  },
});
