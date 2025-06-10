# Deep research agent using Trigger.dev and Vercel's AI SDK

> **Developer acknowledgement**: This example project is derived from the [deep research guide](https://aie-feb-25.vercel.app/docs/deep-research) by [Nico Albanese](https://x.com/nicoalbanese10).

## Overview

An intelligent deep research agent that autonomously conducts multi-layered web research, generating comprehensive reports with PDF output.

This project uses:

- **[Next.js](https://nextjs.org/)** - React framework for the web application
- **[Vercel AI SDK](https://sdk.vercel.ai/)** - For AI model integration and structured generation
- **[Trigger.dev](https://trigger.dev)** - Task orchestration and realtime progress updates
- **[OpenAI GPT-4o](https://openai.com/gpt-4)** - For intelligent query generation, content analysis, and report creation (but you can easily use any other model)
- **[Exa API](https://exa.ai/)** - Semantic web search with live crawling
- **[LibreOffice](https://www.libreoffice.org/)** - For PDF generation
- **[Cloudflare R2](https://developers.cloudflare.com/r2/)** - Cloud storage for generated reports, but can be adapted to be used with any s3 compatible storage

## Features

- [Recursive Research](/src/trigger/deepResearch.ts): AI generates follow-up questions and searches deeper based on initial findings
- [Real-time Progress](/src/components/DeepResearchAgent.tsx): Live updates through Trigger.dev Realtime as research progresses
- [Intelligent Source Evaluation](/src/trigger/deepResearch.ts): GPT-4 model evaluates search result relevance before processing
- [Professional Reports](/src/trigger/generateReport.ts): Automatically generates structured HTML reports converted to PDF
- [Cloud Storage](/src/trigger/generatePdfAndUpload.ts): Uploads completed reports to Cloudflare R2 for easy access

## Getting started

1. After cloning the repo, run `npm install` to install the dependencies.
2. Copy the `example.env.local` file to `.env.local` and fill in the required environment variables:
   - **OpenAI API Key**: For GPT-4 analysis and content generation
   - **Exa API Key**: For web search functionality ([get one here](https://exa.ai/))
   - **Trigger.dev Project**: Sign up at [Trigger.dev](https://cloud.trigger.dev/) and create a project
   - **Cloudflare R2**: For PDF storage ([setup guide](https://developers.cloudflare.com/r2/))
3. Copy the project ref from the Trigger.dev dashboard and add it to the `trigger.config.ts` file.
4. Run the Next.js server with `npm run dev`.
5. In a separate terminal, run the Trigger.dev dev CLI command with `npx trigger dev`.

Now visit `http://localhost:3000` and start researching any topic.

## How It Works

### Trigger.dev Orchestration

The research process is orchestrated through three connected Trigger.dev tasks:

1. **[deepResearchOrchestrator](/src/trigger/deepResearch.ts)** - Main entry point that coordinates the entire research workflow using Vercel's AI SDK
2. **[generateReport](/src/trigger/generateReport.ts)** - Processes research data into a structured HTML report using OpenAI's GPT-4o model
3. **[generatePdfAndUpload](/src/trigger/generatePdfAndUpload.ts)** - Converts HTML to PDF using LibreOffice and uploads to R2 cloud storage

Each task uses `triggerAndWait()` to create a dependency chain, ensuring proper sequencing while maintaining isolation and error handling.

As each task is completed, the metadata is updated and the frontend is updated with the new status using the `useRealtimeTaskTrigger` hook.

### Deep Research Recursive Function

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

### Trigger.dev Realtime Progress Updates

Trigger.dev Realtime updates the task metadata on the frontend in real-time.

**Task Metadata**:

```typescript
metadata.set("status", {
  progress: 25,
  label: `Searching the web for: "${query}"`,
});
```

**Frontend (React Hook)**:

We use the [`useRealtimeTaskTrigger`](https://trigger.dev/docs/frontend/react-hooks/triggering#userealtimetasktrigger) hook to get the task metadata and update the frontend in real-time.

```typescript
const triggerInstance = useRealtimeTaskTrigger<typeof deepResearchOrchestrator>(
  "deep-research",
  { accessToken: triggerToken }
);
const { progress, label } = parseStatus(triggerInstance.run?.metadata);
```

**Status updates include:**

- Search query generation progress
- Individual web search status
- Source relevance evaluation
- Learning extraction progress
- Report generation phase
- PDF creation and upload status

## Relevant Code

- **Deep Research Task**: Core logic in [`src/trigger/deepResearch.ts`](src/trigger/deepResearch.ts) - orchestrates the recursive research process
- **Report Generation**: [`src/trigger/generateReport.ts`](src/trigger/generateReport.ts) - creates structured HTML reports from research data
- **PDF Generation**: [`src/trigger/generatePdfAndUpload.ts`](src/trigger/generatePdfAndUpload.ts) - converts reports to PDF and uploads to R2
- **Research Agent UI**: [`src/components/DeepResearchAgent.tsx`](src/components/DeepResearchAgent.tsx) - handles form submission and realtime progress display
- **Progress Component**: [`src/components/progress-section.tsx`](src/components/progress-section.tsx) - displays live research progress

## Learn More

- [Trigger.dev Documentation](https://trigger.dev/docs) - Task orchestration and realtime features
- [Trigger.dev Realtime](https://trigger.dev/docs/realtime) - Live progress streaming to frontend
- [Trigger.dev React Hooks](https://trigger.dev/docs/frontend/react-hooks) - Frontend integration patterns
- [OpenAI API](https://platform.openai.com/docs/api-reference) - GPT-4 integration and prompt engineering
- [Exa API](https://docs.exa.ai/) - Semantic web search capabilities
- [Cloudflare R2](https://developers.cloudflare.com/r2/) - Object storage for generated reports
