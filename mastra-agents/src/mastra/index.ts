import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { weatherAnalyst } from "./agents/weather-analyst";
import { dayPlannerAgent } from "./agents/day-planner";

export const mastra: Mastra = new Mastra({
  storage: new LibSQLStore({
    url: "file:./mastra.db",
  }),
  agents: {
    weatherAnalyst,
    dayPlannerAgent,
  },
});
