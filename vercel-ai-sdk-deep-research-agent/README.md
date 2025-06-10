# Deep research agent using Trigger.dev and Vercel's AI SDK

> **Acknowledgements**: This example project is derived from the brilliant [deep research guide](https://aie-feb-25.vercel.app/docs/deep-research) by [Nico Albanese](https://x.com/nicoalbanese10).

> **ℹ️ Note:** This is a v4 project. If you are using v3 and want to upgrade, please refer to our [v4 upgrade guide](https://trigger.dev/docs/v4-upgrade-guide).

## Overview

This full-stack project is an intelligent deep research agent that autonomously conducts multi-layered web research, generating comprehensive reports which are then converted to PDF and uploaded to storage.

https://github.com/user-attachments/assets/aa86d2b2-7aa7-4948-82ff-5e1e80cf8e37

## Tech stack

This project uses the following technologies:

- **[Next.js](https://nextjs.org/)** for the web app
- **[Vercel's AI SDK](https://sdk.vercel.ai/)** for AI model integration and structured generation
- **[Trigger.dev](https://trigger.dev)** for task orchestration, execution and real-time progress updates
- **[OpenAI's GPT-4o model](https://openai.com/gpt-4)** for intelligent query generation, content analysis, and report creation (this can be modified to use any other model available on the AI SDK)
- **[Exa API](https://exa.ai/)** for semantic web search with live crawling
- **[LibreOffice](https://www.libreoffice.org/)** for PDF generation
- **[Cloudflare R2](https://developers.cloudflare.com/r2/)** to store the generated reports. This can also be adapted to work with any other s3 compatible storage.

## Features

- [Recursive research](/src/trigger/deepResearch.ts): AI generates search queries, evaluates their relevance, asks follow-up questions and searches deeper based on initial findings.
- [Real-time progress](/src/components/DeepResearchAgent.tsx): Live updates are shown on the frontend using Trigger.dev Realtime as research progresses.
- [Intelligent source evaluation](/src/trigger/deepResearch.ts): AI evaluates search result relevance before processing
- [Research report generation](/src/trigger/generateReport.ts): The completed research is converted to a structured HTML report using a detailed system prompt.
- [PDF creation and upload to Cloud storage](/src/trigger/generatePdfAndUpload.ts): The completed reports are then converted to PDF using LibreOffice and uploaded to Cloudflare R2.

## Running the project locally

1. After cloning the repo, run `npm install` to install the dependencies.
2. Copy the `example.env.local` file to `.env` and fill in the required environment variables:
   - OpenAI API key. Create a free account at [OpenAI](https://platform.openai.com/signup).
   - Sign up for a free Trigger.dev account [here](https://cloud.trigger.dev/login) and create a new project.
   - Exa API key for web search. Create a free account at [Exa](https://exa.ai/).
   - Cloudflare R2 bucket for PDF storage. Create a free account at [Cloudflare](https://developers.cloudflare.com/r2/).
3. Copy your project ref from your [Trigger.dev dashboard](https://cloud.trigger.dev/) and add it to the `trigger.config.ts` file.
4. Run the Next.js server with `npm run dev`.
5. In a separate terminal, run the Trigger.dev dev CLI command with `npx trigger@v4-beta dev` (it may ask you to authorize the CLI if you haven't already).
6. To test your deep research agent, go to `http://localhost:3000` and start researching any topic.

## How the deep research agent works

### Trigger.dev Orchestration

The research process is orchestrated through three connected Trigger.dev tasks:

1. [`deepResearchOrchestrator`](/src/trigger/deepResearch.ts) - Main task that coordinates the entire research workflow.
2. [`generateReport`](/src/trigger/generateReport.ts) - Processes research data into a structured HTML report using OpenAI's GPT-4o model
3. [`generatePdfAndUpload`](/src/trigger/generatePdfAndUpload.ts) - Converts HTML to PDF using LibreOffice and uploads to R2 cloud storage

Each task uses `triggerAndWait()` to create a dependency chain, ensuring proper sequencing while maintaining isolation and error handling.

### The deep research recursive function

The core research logic uses a recursive depth-first search approach. A query is recursively expanded and the results are collected.

**Key Parameters:**

- `depth`: Controls recursion levels (default: 2)
- `breadth`: Number of queries per level (default: 2, halved each recursion)

```
Level 0 (Initial Query): "AI safety in autonomous vehicles"
│
├── Level 1 (depth = 1, breadth = 2):
│   ├── Sub-query 1: "Machine learning safety protocols in self-driving cars"
│   │   ├── → Search Web → Evaluate Relevance → Extract Learnings
│   │   └── → Follow-up: "How do neural networks handle edge cases?"
│   │
│   └── Sub-query 2: "Regulatory frameworks for autonomous vehicle testing"
│       ├── → Search Web → Evaluate Relevance → Extract Learnings
│       └── → Follow-up: "What are current safety certification requirements?"
│
└── Level 2 (depth = 2, breadth = 1):
    ├── From Sub-query 1 follow-up:
    │   └── "Neural network edge case handling in autonomous systems"
    │       └── → Search Web → Evaluate → Extract → DEPTH LIMIT REACHED
    │
    └── From Sub-query 2 follow-up:
        └── "Safety certification requirements for self-driving vehicles"
            └── → Search Web → Evaluate → Extract → DEPTH LIMIT REACHED
```

**Process Flow:**

1. **Query Generation**: OpenAI's GPT-4o generates multiple search queries from the input
2. **Web Search**: Each query searches via the Exa API with live crawling
3. **Relevance Evaluation**: OpenAI's GPT-4o evaluates if results help answer the query
4. **Learning Extraction**: Relevant results are analyzed for key insights and follow-up questions
5. **Recursive Deepening**: Follow-up questions become new queries for the next depth level
6. **Accumulation**: All learnings, sources, and queries are accumulated across recursion levels

### Using Trigger.dev Realtime to trigger and subscribe to the deep research task

We use the [`useRealtimeTaskTrigger`](https://trigger.dev/docs/frontend/react-hooks/triggering#userealtimetasktrigger) React hook to trigger the `deep-research` task and subscribe to it's updates.

**Frontend (React Hook)**:

```typescript
const triggerInstance = useRealtimeTaskTrigger<typeof deepResearchOrchestrator>(
  "deep-research",
  { accessToken: triggerToken }
);
const { progress, label } = parseStatus(triggerInstance.run?.metadata);
```

As the research progresses, the metadata is set within the tasks and the frontend is kept updated with every new status:

**Task Metadata**:

```typescript
metadata.set("status", {
  progress: 25,
  label: `Searching the web for: "${query}"`,
});
```

## Relevant code

- **Deep research task**: Core logic in [`src/trigger/deepResearch.ts`](src/trigger/deepResearch.ts) - orchestrates the recursive research process. Here you can change the model, the depth and the breadth of the research.
- **Report generation**: [`src/trigger/generateReport.ts`](src/trigger/generateReport.ts) - creates structured HTML reports from research data. The system prompt is defined in the code - this can be updated to be more or less detailed.
- **PDF generation**: [`src/trigger/generatePdfAndUpload.ts`](src/trigger/generatePdfAndUpload.ts) - converts reports to PDF and uploads to R2. This is a simple example of how to use LibreOffice to convert HTML to PDF.
- **Research agent UI**: [`src/components/DeepResearchAgent.tsx`](src/components/DeepResearchAgent.tsx) - handles form submission and real-time progress display using the `useRealtimeTaskTrigger` hook.
- **Progress component**: [`src/components/progress-section.tsx`](src/components/progress-section.tsx) - displays live research progress.

## Learn more

- [Trigger.dev Documentation](https://trigger.dev/docs) - Task orchestration and real-time features
- [Trigger.dev Realtime](https://trigger.dev/docs/realtime) - Live progress and streaming to frontend
- [Trigger.dev React Hooks](https://trigger.dev/docs/frontend/react-hooks) - Frontend integration patterns
- [OpenAI API](https://platform.openai.com/docs/api-reference) - GPT-4 integration and prompt engineering
- [Exa API](https://docs.exa.ai/) - Semantic web search capabilities
- [Cloudflare R2](https://developers.cloudflare.com/r2/) - Cloud storage provider
