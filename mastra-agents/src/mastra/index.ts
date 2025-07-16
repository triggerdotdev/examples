import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { weatherAnalyst } from "./agents/weather-analyst";
import { clothingAdvisorAgent } from "./agents/clothing-advisor";

// Storage configuration - for production, switch to serverless-compatible storage
// See README.md deployment section for options (Turso, PostgreSQL, etc.)
function createStorage() {
  // Turso (serverless LibSQL)
  if (process.env.TURSO_DATABASE_URL) {
    return new LibSQLStore({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }

  // Local development (won't work in serverless)
  return new LibSQLStore({
    url: "file:./mastra.db",
  });
}

export const mastra: Mastra = new Mastra({
  storage: createStorage(),
  agents: {
    weatherAnalyst,
    clothingAdvisorAgent,
  },
});
