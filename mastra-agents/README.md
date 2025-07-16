# Mastra agents + Trigger.dev real-world example project:

> **ℹ️ Note:** This is a v4 project. If you are using v3 and want to upgrade, please refer to our [v4 upgrade guide](https://trigger.dev/docs/v4-upgrade-guide).

Enter a city and activity, and get a clothing recommendation generated based on the weather.

By combining Mastra's persistent memory system and agent orchestration with Trigger.dev's durable task execution, retries and observability, you get production-ready AI workflows that survive failures, scale automatically, and maintain context across long-running operations.

## Tech stack

- [Node.js](https://nodejs.org) runtime environment
- [Mastra](https://mastra.ai) for AI agent orchestration and memory management
- [Trigger.dev](https://trigger.dev) for task orchestration, batching, and observability
- [OpenAI GPT-4](https://openai.com) for natural language processing
- [Open-Meteo API](https://open-meteo.com) for weather data (no API key required)
- [Zod](https://zod.dev) for schema validation and type safety

## Featured patterns

- **[Agent Memory Sharing](src/trigger/weather-task.ts)**: Efficient data sharing between agents using Mastra's working memory system
- **[Task Orchestration](src/trigger/weather-task.ts)**: Multi-step workflows with `triggerAndWait` for sequential agent execution
- **[Custom Tools](src/mastra/tools/weather-tool.ts)**: External API integration with structured output validation
- **[Agent Specialization](src/mastra/agents/)**: Purpose-built agents with specific roles and instructions
- **[Schema Optimization](src/mastra/schemas/weather-data.ts)**: Lightweight data structures for performance

## 📁 Project Structure

```
src/
├── mastra/
│   ├── agents/
│   │   ├── weather-analyst.ts    # Weather data collection
│   │   ├── clothing-advisor.ts   # Clothing recommendations
│   ├── tools/
│   │   └── weather-tool.ts       # Enhanced weather API tool
│   ├── schemas/
│   │   └── weather-data.ts       # Weather schema
│   └── index.ts                  # Mastra configuration
├── trigger/
│   └── weather-task.ts           # Trigger.dev tasks
└── test-weather-agent.ts         # Local testing
```

## Relevant code

- [src/trigger/weather-task.ts](src/trigger/weather-task.ts) - Multi-step task orchestration with `triggerAndWait` for sequential agent execution and shared memory context
- [src/mastra/agents/weather-analyst.ts](src/mastra/agents/weather-analyst.ts) - Specialized agent for weather data collection with external API integration and memory storage
- [src/mastra/agents/clothing-advisor.ts](src/mastra/agents/clothing-advisor.ts) - Purpose-built agent that reads from working memory and generates natural language responses
- [src/mastra/tools/weather-tool.ts](src/mastra/tools/weather-tool.ts) - Custom Mastra tool with Zod validation for external API calls and error handling
- [src/mastra/schemas/weather-data.ts](src/mastra/schemas/weather-data.ts) - Optimized Zod schema for efficient memory storage and type safety
- [src/mastra/index.ts](src/mastra/index.ts) - Mastra configuration with LibSQL storage and agent registration

## Getting started

1. After cloning the repo, run `npm install` to install the dependencies.
2. Set up your environment variables (see `.env.example`)
3. If you haven't already, sign up for a free Trigger.dev account [here](https://cloud.trigger.dev/login) and create a new project.
4. Copy the project ref from the Trigger.dev dashboard and add it to the `trigger.config.ts` file.
5. In your terminal, run the Trigger.dev dev CLI command with `npx trigger.dev@latest dev`.

Now you should be able to visit your Trigger.dev dashboard and test any of the agent tasks with the example payloads provided in each task file.

## Testing locally

Use the Trigger.dev dashboard to test each task:

### Example payload

```json
{ "city": "New York", "activity": "walking" }
```

## Deployment

This project uses LibSQL as a local database for development, but **LibSQL doesn't work in serverless environments**. For production deployment, you'll need to switch to a serverless-compatible storage option:

- **Turso** (LibSQL-compatible): Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in your environment variables. Create an account and database [here](https://turso.tech/signup).
- **PostgreSQL** (Supabase): Set `DATABASE_URL` in your environment variables. Create an account and database [here](https://supabase.com/dashboard/sign-in).
- **No persistence**: Remove storage from mastra config entirely.

Update `src/mastra/index.ts` with your chosen storage provider before deploying.

## Learn More

To learn more about the technologies used in this project, check out the following resources:

- [Mastra docs](https://docs.mastra.ai) - learn about AI agent orchestration and memory management
- [Mastra working memory](https://docs.mastra.ai/memory/working-memory) - learn about efficient data sharing between agents
- [Trigger.dev docs](https://trigger.dev/docs) - learn about Trigger.dev and its features
- [Trigger.dev task orchestration](https://trigger.dev/docs/triggering#triggering-from-a-task) - learn about sequential task execution with `triggerAndWait`
- [Multi-agent workflow patterns](https://docs.mastra.ai/agents/multi-agent-workflows) - advanced agent collaboration examples
