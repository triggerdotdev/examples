# OpenAI Agents SDK for Typescript with Trigger.dev starter kit

> **ℹ️ Note:** This is a v4 project. If you are using v3 and want to upgrade, please refer to our [v4 upgrade guide](https://trigger.dev/docs/v4-upgrade-guide).

This open source AI agent starter kit includes 7 different tasks, each using a different agent pattern; from basic conversations, to workflows with tools, streaming, guardrails, handoffs, and more.

By combining the OpenAI Agents SDK with Trigger.dev, you can create durable agents that can be deployed to production and scaled to any size, with retries, queues, and full observability built-in.

This project uses:

- [OpenAI Agents SDK for Typescript](https://openai.github.io/openai-agents-js/) for creating and managing AI agents
- [Trigger.dev](https://trigger.dev) for task orchestration, batching, scheduling, and workflow management
- [Zod](https://zod.dev) for payload validation and type safety

## Getting started

1. After cloning the repo, run `npm install` to install the dependencies.
2. Set up your environment variables (see `.env.example`)
3. If you haven't already, sign up for a free Trigger.dev account [here](https://cloud.trigger.dev/login) and create a new project.
4. Copy the project ref from the Trigger.dev dashboard and add it to the `trigger.config.ts` file.
5. In your terminal, run the Trigger.dev dev CLI command with `npx trigger.dev@v4-beta dev`.

Now you should be able to visit your Trigger.dev dashboard and test any of the agent tasks with the example payloads provided in each task file.

## Testing

Use the Trigger.dev dashboard to test each task:

1. Navigate to your project dashboard
2. Select any task from the list
3. Click "Test"
4. Use the example payload from the task file comments
5. Run and observe the results in real-time

## Agent tasks

### Basic Tasks

- **[Basic Agent Chat](src/trigger/basicAgentChat.ts)**: Personality-based conversations with strategic model selection
- **[Agent with Tools](src/trigger/agentWithTools.ts)**: Weather API calls with structured validation
- **[Streaming Agent](src/trigger/streamingAgent.ts)**: Real-time content generation with progress tracking

### Advanced Tasks

- **[Agent Handoffs](src/trigger/agentHandoff.ts)**: True multi-agent collaboration using the [handoff pattern](https://openai.github.io/openai-agents-js/guides/handoffs/) where agents can dynamically transfer control to specialists
- **[Parallel Agents](src/trigger/parallelAgents.ts)**: Concurrent agent processing for complex analysis tasks
- **[Scheduled Agent](src/trigger/scheduledAgent.ts)**: Time-based agent workflows for continuous monitoring
- **[Agent with Guardrails](src/trigger/agentWithGuardrails.ts)**: Input guardrails for safe AI interactions

## Relevant code

- [src/trigger/basicAgentChat.ts](src/trigger/basicAgentChat.ts) - Strategic model selection (GPT-4, o1-preview, o1-mini, gpt-4o-mini) mapped to personality types with Trigger.dev task orchestration
- [src/trigger/agentWithTools.ts](src/trigger/agentWithTools.ts) - OpenAI tool calling with Zod validation integrated into Trigger.dev's retry and error handling mechanisms
- [src/trigger/streamingAgent.ts](src/trigger/streamingAgent.ts) - Native OpenAI streaming responses with real-time progress tracking via Trigger.dev metadata
- [src/trigger/scheduledAgent.ts](src/trigger/scheduledAgent.ts) - Cron-scheduled OpenAI agents running every 6 hours with automatic trend analysis
- [src/trigger/parallelAgents.ts](src/trigger/parallelAgents.ts) - Concurrent OpenAI agent execution using Trigger.dev batch operations (`batch.triggerByTaskAndWait`) for scalable text analysis
- [src/trigger/agentWithGuardrails.ts](src/trigger/agentWithGuardrails.ts) - OpenAI classification agents as input guardrails with structured validation and exception handling
- [src/trigger/agentHandoff.ts](src/trigger/agentHandoff.ts) - OpenAI Agents SDK handoff pattern with specialist delegation orchestrated through Trigger.dev workflows

## Learn More

To learn more about the technologies used in this project, check out the following resources:

- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-js/) - learn about creating and managing AI agents
- [OpenAI Agents SDK handoffs](https://openai.github.io/openai-agents-js/guides/handoffs/) - learn about agent-to-agent delegation patterns
- [Trigger.dev docs](https://trigger.dev/docs) - learn about Trigger.dev and its features
- [Trigger.dev batch operations](https://trigger.dev/docs/triggering#batch-trigger) - learn about parallel task execution
- [Trigger.dev scheduled tasks (cron)](https://trigger.dev/docs/tasks/scheduled#scheduled-tasks-cron) - learn about cron-based task scheduling
- [Multi-agent collaboration patterns](https://cookbook.openai.com/examples/agents_sdk/multi-agent-portfolio-collaboration/multi_agent_portfolio_collaboration) - advanced agent orchestration examples
