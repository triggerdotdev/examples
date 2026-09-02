# Ask Trigger

Ask Trigger is a [Trigger.dev chat agent](https://trigger.dev/docs/ai-chat/overview) that **teaches you Trigger.dev** by *drawing*. Instead of dumping paragraphs, it composes interactive components. Ask "how does a fan-out with retries work?" and you get an **interactive node-graph** of the flow. Ask it to teach you retries and you get a short explainer, a **quiz**, and a gotcha **callout**. Every turn ends with next-step chips so the learning keeps flowing.

The agent decides how best to teach. It writes a sentence or two, then calls a `renderVisualization` tool with a [json-render](https://json-render.dev) spec, and the Next.js chat UI renders it live with [React Flow](https://reactflow.dev) and a kit of [shadcn/ui](https://ui.shadcn.com)-based teaching components. The model supplies *data*, not markup, so a card is a handful of tokens and always looks right. Every fact it states is grounded on the live docs through a documentation [MCP server](https://modelcontextprotocol.io), so it doesn't invent API surface (and if the docs server is unreachable, it says it's answering from general knowledge rather than pretend).

The teaching method (mission-first, one tangible win per turn, knowledge then a retrieval quiz, everything grounded in trusted sources) is adapted from [Matt Pocock's "teach" skill](https://www.aihero.dev/learn-anything-with-my-teach-skill) ([source](https://github.com/mattpocock/skills/tree/main/skills/productivity/teach)), reworked from a local-filesystem workspace into an in-chat experience.

## How it works

**The agent** (`src/trigger/trigger-chat-agent.ts`) is a single `chat.agent()` call. Trigger.dev handles the chat session, turn loop, streaming and resumability. Its system prompt is a versioned [AI Prompt](https://trigger.dev/docs/ai/prompts) (`prompts.define()` + `chat.prompt.set()`), so you can edit the teaching guidance, model or temperature from the dashboard without redeploying. Model calls emit spans that follow the OpenTelemetry [GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/), so any span with the standard `gen_ai` attributes gets cost data automatically: you get token, cost and latency observability in the dashboard, linked to the prompt version that produced each call, for free. Most turns answer on a fast, low-cost model (Claude Haiku); only genuinely hard teaching turns (architecture, comparisons, multi-step flows) escalate per turn to a stronger model (Claude Sonnet), so the common case stays cheap and quick. It has two kinds of tools:

- **`renderVisualization`** takes a json-render UI spec composed from the component kit (FlowGraph, HeroCard, Quiz, Callout, Compare, Steps, Glossary, StatCard, CodeCard, DiagramCard, PromptCard). The spec is validated against the component catalog, and validation errors go back to the model so it can correct the spec and retry.
- **`suggestNext`** is called at the end of every turn with 2 to 4 next-step chips: a *deeper* step, a *sideways* related concept, a *practice* quiz, or fresh *topic* suggestions. The chip's label is sent verbatim as the next message when clicked, so the learning keeps flowing without the user having to think up the next question.
- **Docs MCP tools** are merged in from a documentation MCP server (default: the hosted [Context7](https://context7.com) server) so the agent looks up Trigger.dev APIs, config and behaviour instead of answering from memory. The tools are resolved per turn and declared on the agent config, so their calls survive Trigger.dev's cross-turn history re-conversion. Swap `DOCS_MCP_URL` to point the demo at any other product's docs MCP. Retrieved docs are **untrusted input** (a poisoned page is the upstream prompt-injection vector), so each tool's output is quarantined (`src/lib/quarantine.ts`): wrapped as data-not-instructions and flagged if it contains injection markers, before the model ever sees it.

**The shared catalog** (`src/lib/catalog.ts`) defines which components the model may use: `Card`, `Stack`, `Grid`, `Heading`, `Text`, `Badge` from [`@json-render/shadcn`](https://www.npmjs.com/package/@json-render/shadcn), plus a kit of custom teaching components. They're all **data-driven** (the model fills fields, the component renders), so there's no model-authored markup to sanitize and every card is cheap and consistent:

- **`FlowGraph`** (`src/components/flow-graph.tsx`) is the signature visual: a directed node-graph on [React Flow](https://reactflow.dev) + [dagre](https://github.com/dagrejs/dagre) styled like the Trigger.dev dashboard, with status dots, dashed retry edges, an animated topological reveal, and an optional timed status sequence.
- **`HeroCard`** and **`StatCard`** are the intro card and KPI card, ported from the Trigger.dev Launch Week designs.
- **`Quiz`** is a multiple-choice question with immediate feedback (retrieval practice). **`Callout`**, **`Compare`**, **`Steps`** and **`Glossary`** cover gotchas, "X vs Y", walkthroughs, and term/definition lists. **`CodeCard`**, **`DiagramCard`** and **`PromptCard`** round out the kit.

The same catalog generates the system-prompt component reference and validates tool calls, so the prompt and the renderer can't drift apart.

**The frontend** (`src/app`, `src/components`) is a Next.js app using [`useChat`](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat) with [`useTriggerChatTransport`](https://trigger.dev/docs/ai-chat/frontend). The browser talks directly to Trigger.dev's durable streams, no API route needed. `renderVisualization` tool parts in the message stream are rendered with json-render's `<Renderer>` and the shadcn component registry (`src/lib/registry.tsx`).

Conversations are **device-local**: each has its own URL (`/c/<id>`) and its transcript is saved in the browser (`src/lib/chat-store.ts`, IndexedDB), so a refresh restores the thread and the sidebar lists your past chats, newest first. There's no server database, so history never leaves the machine.

## Setup

1. Create a project in the [Trigger.dev dashboard](https://cloud.trigger.dev) and copy its project ref and a dev secret key (API keys page).

2. Configure the environment:

   ```sh
   cp .env.example .env
   # paste your project ref and secret key into .env
   ```

3. In the dashboard, add environment variables (Environment Variables page) for the Dev environment (and Prod if you deploy):

   - `ANTHROPIC_API_KEY`: the agent uses Claude via the AI SDK.
   - `DOCS_MCP_URL` *(optional)*: the docs MCP server to ground answers on. Defaults to `https://mcp.context7.com/mcp`. Point it at another product's docs MCP to fork the demo to a different domain.

4. Install and run both processes (two terminals):

   ```sh
   pnpm install
   pnpm dev:trigger   # the agent
   pnpm dev           # the Next.js app
   ```

5. Open [http://localhost:3000](http://localhost:3000) and start asking.


## Try asking

- "What is Trigger.dev, and how does it work?" gets a ground-up explainer.
- "Teach me retries properly" gets an explainer, a quiz, and a gotcha callout.
- "How does a fan-out with retries work?" draws an interactive FlowGraph.
- "How does a run survive a redeploy?" draws the checkpoints.
- "Suggest more topics" and it proposes a fresh set, grounded in the docs.

Then follow the next-step chips under each answer to keep going.

## Deploy

```sh
pnpm deploy:trigger
```

Make sure `ANTHROPIC_API_KEY` (and optionally `DOCS_MCP_URL`) are set for the Prod environment in the dashboard, and deploy the Next.js app anywhere with `TRIGGER_SECRET_KEY` (prod) set.

### Running it publicly

The session server actions are unauthenticated, so anyone with the URL can start a chat. That's fine for a personal or gated deploy, but open by default. Two guardrails to know about:

- The agent caps concurrent chats (`queue.concurrencyLimit` in `src/trigger/trigger-chat-agent.ts`) to throttle a flood. That limits throughput, not total spend, so set an org spend limit in the Trigger.dev dashboard (Billing) for a real ceiling.
- Add an ownership check in `mintChatAccessToken` (`src/app/actions.ts`) before real multi-user use, otherwise anyone who learns a chat id can read and post to that session.
