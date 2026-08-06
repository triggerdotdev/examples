# Trigger.dev chat agent — diagrams, not walls of text

A [Trigger.dev chat agent](https://trigger.dev/docs/ai-chat/overview) that teaches you how Trigger.dev works — and answers by **drawing**. Ask "how does a fan-out with retries work?" and instead of a wall of text you get an **interactive node-graph** of the flow, plus a code card you can read and a prompt card you can paste into your own coding agent.

The agent decides when a visualization beats prose: it calls a `renderVisualization` tool with a [json-render](https://json-render.dev) spec, and the Next.js chat UI renders it live with [React Flow](https://reactflow.dev) and [shadcn/ui](https://ui.shadcn.com) components. Every fact it states is grounded on the live docs through a documentation [MCP server](https://modelcontextprotocol.io), so it doesn't invent API surface.

## How it works

**The agent** (`src/trigger/trigger-chat-agent.ts`) is a single `chat.agent()` call — Trigger.dev handles the chat session, turn loop, streaming and resumability. Its system prompt is a versioned [AI Prompt](https://trigger.dev/docs/ai/prompts) (`prompts.define()` + `chat.prompt.set()`), so you can edit the teaching guidance, model or temperature from the dashboard without redeploying — and every model call is traced in the run with token, cost and latency metrics linked to the prompt version. It has two kinds of tools:

- **`renderVisualization`** — takes a json-render UI spec (an interactive FlowGraph, plus code / diagram / prompt / stat cards, composed in cards and grids). The spec is validated against the component catalog; validation errors go back to the model so it can correct the spec and retry.
- **Docs MCP tools** — merged in from a documentation MCP server (default: the hosted [Context7](https://context7.com) server) so the agent looks up Trigger.dev APIs, config and behaviour instead of answering from memory. The tools are resolved per turn and declared on the agent config, so their calls survive Trigger.dev's cross-turn history re-conversion. Swap `DOCS_MCP_URL` to point the demo at any other product's docs MCP.

**The shared catalog** (`src/lib/catalog.ts`) defines which components the model may use — `Card`, `Stack`, `Grid`, `Heading`, `Text`, `Badge` from [`@json-render/shadcn`](https://www.npmjs.com/package/@json-render/shadcn), plus custom `FlowGraph`, `DiagramCard`, `CodeCard`, `PromptCard` and `Stat` components. The star is **`FlowGraph`** (`src/components/flow-graph.tsx`): a directed node-graph on [React Flow](https://reactflow.dev) + [dagre](https://github.com/dagrejs/dagre) styled like the Trigger.dev dashboard — status dots, dashed retry edges, an animated topological reveal, and an optional timed status sequence. The same catalog generates the system-prompt component reference and validates tool calls, so the prompt and the renderer can't drift apart.

**The frontend** (`src/app`, `src/components`) is a Next.js app using [`useChat`](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat) with [`useTriggerChatTransport`](https://trigger.dev/docs/ai-chat/frontend) — the browser talks directly to Trigger.dev's durable streams, no API route needed. `renderVisualization` tool parts in the message stream are rendered with json-render's `<Renderer>` and the shadcn component registry (`src/lib/registry.tsx`).

## Setup

1. Create a project in the [Trigger.dev dashboard](https://cloud.trigger.dev) and copy its project ref and a dev secret key (API keys page).

2. Configure the environment:

   ```sh
   cp .env.example .env
   # paste your project ref and secret key into .env
   ```

3. In the dashboard, add environment variables (Environment Variables page) for the Dev environment (and Prod if you deploy):

   - `ANTHROPIC_API_KEY` — the agent uses Claude via the AI SDK
   - `DOCS_MCP_URL` *(optional)* — the docs MCP server to ground answers on. Defaults to `https://mcp.context7.com/mcp`. Point it at another product's docs MCP to fork the demo to a different domain.

4. Install and run both processes (two terminals):

   ```sh
   pnpm install
   pnpm dev:trigger   # the agent
   pnpm dev           # the Next.js app
   ```

5. Open [http://localhost:3000](http://localhost:3000) and start asking.

## Try asking

- "How does a fan-out with retries work?"
- "Show me the lifecycle of a task run"
- "How do waitpoints and human-in-the-loop work?"
- "How does this chat agent work under the hood?"
- "How do queues and concurrency limits fit together?"

## Deploy

```sh
pnpm deploy:trigger
```

Make sure `ANTHROPIC_API_KEY` (and optionally `DOCS_MCP_URL`) are set for the Prod environment in the dashboard, and deploy the Next.js app anywhere with `TRIGGER_SECRET_KEY` (prod) set.
