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

- **[Basic Agent Chat](src/trigger/basicAgentChat.ts)**: Personality-based conversations with model optimization
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
- [src/trigger/parallelAgents.ts](src/trigger/parallelAgents.ts) - Concurrent OpenAI agent execution using Trigger.dev batch operations for scalable text analysis
- [src/trigger/agentWithGuardrails.ts](src/trigger/agentWithGuardrails.ts) - OpenAI classification agents as input guardrails with structured validation and exception handling
- [src/trigger/agentHandoff.ts](src/trigger/agentHandoff.ts) - OpenAI Agents SDK handoff pattern with specialist delegation orchestrated through Trigger.dev workflows

## Platform capabilities

- **Durable Task Orchestration**: Built on Trigger.dev v4 with automatic retries, queuing, and failure recovery for production-grade agent workflows
- **Multi-Model Architecture**: Strategic model selection across GPT-4, o1-preview, o1-mini, and gpt-4o-mini based on task complexity and cost optimization
- **Agent-to-Agent Handoffs**: True multi-agent collaboration with structured data passing and LLM-powered decision making for specialist delegation
- **Concurrent Processing**: Parallel agent execution using batch operations for scalable multi-task analysis and processing
- **Real-time Streaming**: Native streaming support with progress tracking and metadata updates for live response generation
- **Content Safety**: Input guardrails with classification agents and structured validation to prevent misuse and ensure safe interactions
- **Production Observability**: Full logging, monitoring, and debugging through Trigger.dev dashboard with execution traces and performance metrics
- **Type-Safe Development**: Complete TypeScript integration with Zod validation for payload safety and enhanced developer experience

## Learn More

To learn more about the technologies used in this project, check out the following resources:

- [OpenAI Agents SDK Documentation](https://platform.openai.com/docs/agents) - learn about creating and managing AI agents
- [OpenAI Agents SDK Handoffs Guide](https://openai.github.io/openai-agents-js/guides/handoffs/) - learn about agent-to-agent delegation patterns
- [Trigger.dev Documentation](https://trigger.dev/docs) - learn about Trigger.dev and its features
- [Trigger.dev Task Development](https://trigger.dev/docs/tasks) - learn about creating and managing tasks
- [Trigger.dev Batch Operations](https://trigger.dev/docs/tasks/batch) - learn about parallel task execution
- [Trigger.dev Scheduling](https://trigger.dev/docs/tasks/scheduled) - learn about cron-based task scheduling
- [Multi-Agent Collaboration Patterns](https://cookbook.openai.com/examples/agents_sdk/multi-agent-portfolio-collaboration/multi_agent_portfolio_collaboration) - advanced agent orchestration examples
