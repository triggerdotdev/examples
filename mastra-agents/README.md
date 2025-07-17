# Mastra agents with memory sharing + Trigger.dev task orchestration example project:

> **ℹ️ Note:** This is a Trigger.dev v4 project. If you are using v3 and want to upgrade, please refer to our [v4 upgrade guide](https://trigger.dev/docs/v4-upgrade-guide).

Enter a city and a activity, and get a clothing recommendation generated for you based on today's weather.

![agent-output](https://github.com/user-attachments/assets/edfca304-6b22-4fa8-9362-71ecb3fe4903)

By combining Mastra's persistent memory system and agent orchestration with Trigger.dev's durable task execution, retries and observability, you get production-ready AI workflows that survive failures, scale automatically, and maintain context across long-running operations.

## Tech stack

- [Node.js](https://nodejs.org) runtime environment
- [Mastra](https://mastra.ai) for AI agent orchestration and memory management
- [PostgreSQL](https://postgresql.org) for persistent storage and memory sharing
- [Trigger.dev](https://trigger.dev) for task orchestration, batching, and observability
- [OpenAI GPT-4](https://openai.com) for natural language processing
- [Open-Meteo API](https://open-meteo.com) for weather data (no API key required)
- [Zod](https://zod.dev) for schema validation and type safety

## Featured patterns

- **[Agent Memory Sharing](src/trigger/weather-task.ts)**: Efficient data sharing between agents using Mastra's working memory system
- **[Task Orchestration](src/trigger/weather-task.ts)**: Multi-step workflows with `triggerAndWait` for sequential agent execution
- **[Centralized Storage](src/mastra/index.ts)**: Single PostgreSQL storage instance shared across all agents to prevent connection duplication
- **[Custom Tools](src/mastra/tools/weather-tool.ts)**: External API integration with structured output validation
- **[Agent Specialization](src/mastra/agents/)**: Purpose-built agents with specific roles and instructions
- **[Schema Optimization](src/mastra/schemas/weather-data.ts)**: Lightweight data structures for performance

## Project Structure

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
```

## Relevant code

- [src/trigger/weather-task.ts](src/trigger/weather-task.ts) - Multi-step task orchestration with `triggerAndWait` for sequential agent execution and shared memory context
- [src/mastra/agents/weather-analyst.ts](src/mastra/agents/weather-analyst.ts) - Specialized agent for weather data collection with external API integration and memory storage
- [src/mastra/agents/clothing-advisor.ts](src/mastra/agents/clothing-advisor.ts) - Purpose-built agent that reads from working memory and generates natural language responses
- [src/mastra/tools/weather-tool.ts](src/mastra/tools/weather-tool.ts) - Custom Mastra tool with Zod validation for external API calls and error handling
- [src/mastra/schemas/weather-data.ts](src/mastra/schemas/weather-data.ts) - Optimized Zod schema for efficient memory storage and type safety
- [src/mastra/index.ts](src/mastra/index.ts) - Mastra configuration with PostgreSQL storage and agent registration

## Storage Architecture

This project uses a **centralized PostgreSQL storage** approach where a single database connection is shared across all Mastra agents. This prevents duplicate database connections and ensures efficient memory sharing between the weather analyst and clothing advisor agents.

### Storage Configuration

The storage is configured once in the main Mastra instance (`src/mastra/index.ts`) and automatically inherited by all agent Memory instances. This eliminates the "duplicate database object" warning that can occur with multiple PostgreSQL connections.

The PostgreSQL storage works seamlessly in both local development and serverless environments with any PostgreSQL provider, such as:

- [Local PostgreSQL instance](https://postgresql.org)
- [Supabase](https://supabase.com) - Serverless PostgreSQL
- [Neon](https://neon.tech) - Serverless PostgreSQL
- [Railway](https://railway.app) - Simple PostgreSQL hosting
- [AWS RDS](https://aws.amazon.com/rds/postgresql/) - Managed PostgreSQL

## Running the project

1. After cloning the repo, run `npm install` to install the dependencies.
2. Set up your environment variables (see `.env.example`)
3. If you haven't already, sign up for a free Trigger.dev account [here](https://cloud.trigger.dev/login) and create a new project.
4. Copy the project ref from the Trigger.dev dashboard and add it to the `trigger.config.ts` file.
5. In your terminal, run the Trigger.dev dev CLI command with `npx trigger.dev@v4-beta dev`.

Now you should be able to visit your Trigger.dev dashboard and test any of the agent tasks with the example payloads provided in each task file.

## Testing

### Example payload

```json
{
  "city": "New York",
  "activity": "walking"
}
```

## Learn More

To learn more about the technologies used in this project, check out the following resources:

- [Mastra docs](https://mastra.ai/en/docs) - learn about AI agent orchestration and memory management
- [Mastra working memory](https://mastra.ai/en/docs/memory/overview) - learn about efficient data sharing between agents
- [Trigger.dev docs](https://trigger.dev/docs) - learn about Trigger.dev and its features
