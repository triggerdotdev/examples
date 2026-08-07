# Trigger.dev chat agent — learn by doing, not walls of text

A [Trigger.dev chat agent](https://trigger.dev/docs/ai-chat/overview) that **teaches you Trigger.dev** — and teaches by *drawing* and composing interactive components instead of dumping paragraphs. Ask "how does a fan-out with retries work?" and you get an **interactive node-graph** of the flow; ask it to teach you retries and you get a short explainer, a **quiz**, and a gotcha **callout**. Every turn ends with next-step chips so the learning keeps flowing.

The agent decides how best to teach: it writes a sentence or two, then calls a `renderVisualization` tool with a [json-render](https://json-render.dev) spec, and the Next.js chat UI renders it live with [React Flow](https://reactflow.dev) and a kit of [shadcn/ui](https://ui.shadcn.com)-based teaching components. The model supplies *data*, not markup, so a card is a handful of tokens and always looks right. Every fact it states is grounded on the live docs through a documentation [MCP server](https://modelcontextprotocol.io), so it doesn't invent API surface.

The teaching method — mission-first, one tangible win per turn, knowledge then a retrieval quiz, ground everything in trusted sources — is adapted from [Matt Pocock's "teach" skill](https://www.aihero.dev/learn-anything-with-my-teach-skill) ([source](https://github.com/mattpocock/skills/tree/main/skills/productivity/teach)), reworked from a local-filesystem workspace into an in-chat experience.

## How it works

**The agent** (`src/trigger/trigger-chat-agent.ts`) is a single `chat.agent()` call — Trigger.dev handles the chat session, turn loop, streaming and resumability. Its system prompt is a versioned [AI Prompt](https://trigger.dev/docs/ai/prompts) (`prompts.define()` + `chat.prompt.set()`), so you can edit the teaching guidance, model or temperature from the dashboard without redeploying — and every model call is traced in the run with token, cost and latency metrics linked to the prompt version. It has two kinds of tools:

- **`renderVisualization`** — takes a json-render UI spec composed from the component kit (FlowGraph, HeroCard, Quiz, Callout, Compare, Steps, Glossary, StatCard, CodeCard, DiagramCard, PromptCard). The spec is validated against the component catalog; validation errors go back to the model so it can correct the spec and retry.
- **`suggestNext`** — called at the end of every turn with 2–4 next-step chips (a *deeper* step, a *sideways* related concept, a *practice* quiz, or fresh *topic* suggestions). The chip's label is sent verbatim as the next message when clicked, so the learning keeps flowing without the user having to think up the next question.
- **Docs MCP tools** — merged in from a documentation MCP server (default: the hosted [Context7](https://context7.com) server) so the agent looks up Trigger.dev APIs, config and behaviour instead of answering from memory. The tools are resolved per turn and declared on the agent config, so their calls survive Trigger.dev's cross-turn history re-conversion. Swap `DOCS_MCP_URL` to point the demo at any other product's docs MCP. Retrieved docs are **untrusted input** — a poisoned page is the upstream prompt-injection vector — so each tool's output is quarantined (`src/lib/quarantine.ts`): wrapped as data-not-instructions and flagged if it contains injection markers, before the model ever sees it.

**The shared catalog** (`src/lib/catalog.ts`) defines which components the model may use — `Card`, `Stack`, `Grid`, `Heading`, `Text`, `Badge` from [`@json-render/shadcn`](https://www.npmjs.com/package/@json-render/shadcn), plus a kit of custom teaching components. They're all **data-driven** (the model fills fields; the component renders), so there's no model-authored markup to sanitize and every card is cheap and consistent:

- **`FlowGraph`** (`src/components/flow-graph.tsx`) — the signature visual: a directed node-graph on [React Flow](https://reactflow.dev) + [dagre](https://github.com/dagrejs/dagre) styled like the Trigger.dev dashboard, with status dots, dashed retry edges, an animated topological reveal, and an optional timed status sequence.
- **`HeroCard`** / **`StatCard`** — the intro card and KPI card, ported from the Trigger.dev Launch Week designs.
- **`Quiz`** — a multiple-choice question with immediate feedback (retrieval practice). **`Callout`**, **`Compare`**, **`Steps`**, **`Glossary`** — gotchas, "X vs Y", walkthroughs, and term/definition lists. **`CodeCard`**, **`DiagramCard`**, **`PromptCard`** round out the kit.

The same catalog generates the system-prompt component reference and validates tool calls, so the prompt and the renderer can't drift apart.

**Chat history (optional)** is where the agent's [lifecycle hooks](https://trigger.dev/docs/ai-chat/lifecycle-hooks) earn their keep. Set `DATABASE_URL` and you get a sidebar of past conversations, resume-on-reload, and delete; leave it unset and the app runs exactly as it does without a database, no sidebar. Three hooks do the work, and each one is placed deliberately:

- **`onChatStart`** creates the conversation row. It fires once per chat and never on continuation runs — exactly the lifetime of the row.
- **`onTurnStart`** persists the messages, **awaited**. `chat.agent` doesn't start streaming until this resolves, so the user's question is durable before the model runs. (A fire-and-forget write here means a refresh mid-stream loses the question.) It also sets the system prompt — unlike `onChatStart`, this hook fires on continuation runs, so the prompt survives an idle resume.
- **`onTurnComplete`** writes the finished turn and the transport's resume cursor **in one transaction**. Separately, a refresh landing between the two writes could resume from a stale cursor and replay the turn on top of the message it already has.

Notably, resuming an interrupted stream needs no extra infrastructure here: the run is durable and the transport reconnects with `lastEventId`. Vercel's `ai-chatbot` template needs Redis, an extra package and a table to do the same thing.

**Schema** (`src/lib/db/schema.ts`): a `chat` row holds `UIMessage[]` in a single JSON column — tool-call shapes change with every AI SDK release, and a JSON column means an SDK upgrade never needs a migration — plus a `chat_session` row holding the access token and SSE cursor. Chats are owned by an anonymous id set in a cookie by `src/proxy.ts`: no login, but every query is still scoped by user, so a chat id can't be guessed to read someone else's conversation.

**The frontend** (`src/app`, `src/components`) is a Next.js app using [`useChat`](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat) with [`useTriggerChatTransport`](https://trigger.dev/docs/ai-chat/frontend) — the browser talks directly to Trigger.dev's durable streams, no API route needed. `renderVisualization` tool parts in the message stream are rendered with json-render's `<Renderer>` and the shadcn component registry (`src/lib/registry.tsx`).

## Setup

1. Create a project in the [Trigger.dev dashboard](https://cloud.trigger.dev) and copy its project ref and a dev secret key (API keys page).

2. Create a `.env` in this directory with your Trigger.dev credentials:

   ```sh
   TRIGGER_PROJECT_REF=proj_xxxxxxxxxxxx
   TRIGGER_SECRET_KEY=tr_dev_xxxxxxxxxxxx
   # Optional, only if self-hosting (exposed to the browser for the SSE endpoints):
   # NEXT_PUBLIC_TRIGGER_API_URL=https://your-trigger-instance
   ```

3. In the dashboard, add environment variables (Environment Variables page) for the Dev environment (and Prod if you deploy):

   - `ANTHROPIC_API_KEY` — the agent uses Claude via the AI SDK
   - `DOCS_MCP_URL` *(optional)* — the docs MCP server to ground answers on. Defaults to `https://mcp.context7.com/mcp`. Point it at another product's docs MCP to fork the demo to a different domain.
   - `DATABASE_URL` *(optional)* — enables chat history. See below.

4. Install and run both processes (two terminals):

   ```sh
   pnpm install
   pnpm dev:trigger   # the agent
   pnpm dev           # the Next.js app
   ```

5. Open [http://localhost:3000](http://localhost:3000) and start asking.

## Optional: chat history

Skip this and the app works fine — you just won't have a sidebar or history. To turn it on, create a free [Supabase](https://supabase.com) project and grab two connection strings from **Project Settings → Database** (they're different on purpose):

```sh
# App + agent. Transaction mode (the pooler, port 6543): short-lived Trigger
# runs each open a connection, and the pooler is what makes that safe.
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-<region>.pooler.supabase.com:6543/postgres

# Migrations only, from your machine. Session mode (port 5432) — it allows DDL
# and works on IPv4 networks, unlike the direct connection.
MIGRATION_DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-<region>.pooler.supabase.com:5432/postgres
```

Then create the tables:

```sh
pnpm db:push
```

Add **`DATABASE_URL`** to the Trigger.dev dashboard too — the agent writes the history from inside the task, which runs on Trigger's infrastructure, so it needs its own copy. `MIGRATION_DATABASE_URL` stays local; the deployed worker never migrates.

<sub>The example uses `pg` rather than `postgres.js` deliberately: Supabase's transaction pooler doesn't support prepared statements, and `pg` doesn't use them by default — so there's no `prepare: false` flag to forget.</sub>

## Try asking

- "What is Trigger.dev, and how does it work?" — a ground-up explainer
- "Teach me retries properly" — an explainer, a quiz, and a gotcha callout
- "How does a fan-out with retries work?" — an interactive FlowGraph
- "How does a run survive a redeploy?" — checkpoints, drawn
- "Suggest more topics" — the agent proposes a fresh set, grounded in the docs

Then follow the next-step chips under each answer to keep going.

## Deploy

```sh
pnpm deploy:trigger
```

Make sure `ANTHROPIC_API_KEY` (and optionally `DOCS_MCP_URL`) are set for the Prod environment in the dashboard, and deploy the Next.js app anywhere with `TRIGGER_SECRET_KEY` (prod) set.
