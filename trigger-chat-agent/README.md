# Trigger.dev chat agent — learn by doing, not walls of text

A [Trigger.dev chat agent](https://trigger.dev/docs/ai-chat/overview) that **teaches you Trigger.dev** — and teaches by *drawing* and by *building interactive lessons* instead of dumping paragraphs. Ask "how does a fan-out with retries work?" and you get an **interactive node-graph** of the flow; ask it to teach you retries and you get a **self-contained lesson** with a quick quiz. Every turn ends with next-step chips so the learning keeps flowing.

The agent decides how best to teach: it calls a `renderVisualization` tool with a [json-render](https://json-render.dev) spec, and the Next.js chat UI renders it live with [React Flow](https://reactflow.dev), [shadcn/ui](https://ui.shadcn.com), and sandboxed HTML lessons. Every fact it states is grounded on the live docs through a documentation [MCP server](https://modelcontextprotocol.io), so it doesn't invent API surface.

The teaching method — mission-first, one tangible win per turn, knowledge then a retrieval quiz, ground everything in trusted sources — is adapted from [Matt Pocock's "teach" skill](https://www.aihero.dev/learn-anything-with-my-teach-skill) ([source](https://github.com/mattpocock/skills/tree/main/skills/productivity/teach)), reworked from a local-filesystem workspace into an in-chat experience.

## How it works

**The agent** (`src/trigger/trigger-chat-agent.ts`) is a single `chat.agent()` call — Trigger.dev handles the chat session, turn loop, streaming and resumability. Its system prompt is a versioned [AI Prompt](https://trigger.dev/docs/ai/prompts) (`prompts.define()` + `chat.prompt.set()`), so you can edit the teaching guidance, model or temperature from the dashboard without redeploying — and every model call is traced in the run with token, cost and latency metrics linked to the prompt version. It has two kinds of tools:

- **`renderVisualization`** — takes a json-render UI spec (an interactive FlowGraph, an HTML `Lesson`, plus code / diagram / prompt / stat cards). The spec is validated against the component catalog; validation errors go back to the model so it can correct the spec and retry.
- **`suggestNext`** — called at the end of every turn with 2–4 next-step chips (a *deeper* step, a *sideways* related concept, a *practice* quiz, or fresh *topic* suggestions). The chip's label is sent verbatim as the next message when clicked, so the learning keeps flowing without the user having to think up the next question.
- **Docs MCP tools** — merged in from a documentation MCP server (default: the hosted [Context7](https://context7.com) server) so the agent looks up Trigger.dev APIs, config and behaviour instead of answering from memory. The tools are resolved per turn and declared on the agent config, so their calls survive Trigger.dev's cross-turn history re-conversion. Swap `DOCS_MCP_URL` to point the demo at any other product's docs MCP.

**The shared catalog** (`src/lib/catalog.ts`) defines which components the model may use — `Card`, `Stack`, `Grid`, `Heading`, `Text`, `Badge` from [`@json-render/shadcn`](https://www.npmjs.com/package/@json-render/shadcn), plus custom `FlowGraph`, `Lesson`, `DiagramCard`, `CodeCard`, `PromptCard` and `Stat` components. Two do the heavy lifting:

- **`FlowGraph`** (`src/components/flow-graph.tsx`) — a directed node-graph on [React Flow](https://reactflow.dev) + [dagre](https://github.com/dagrejs/dagre) styled like the Trigger.dev dashboard: status dots, dashed retry edges, an animated topological reveal, an optional timed status sequence.
- **`Lesson`** (`src/components/lesson.tsx`) — a model-authored HTML lesson (Tufte-style prose + an interactive quiz + citations) rendered in a **sandboxed `<iframe>`** (`allow-scripts`, no `allow-same-origin`), so its scripts run isolated and can't reach the app origin or the Trigger session token — the same model as Claude/v0 artifacts. A shared stylesheet keeps every lesson on-brand.

Because lesson HTML is the one untrusted, model-authored code path (the model can be steered by injected docs content), it gets **three layers of defense**:

1. **Sandbox** — opaque-origin iframe: can't read the parent DOM, cookies, or the session token; no top-navigation, popups, or forms.
2. **Content-Security-Policy** injected into the lesson (`connect-src`/`form-action` `'none'`, `img-src data:`) — deterministically blocks exfiltration and phishing beacons.
3. **Pre-render screening** in the agent (`src/lib/lesson-screen.ts` + a fan-out of screener agents in `src/trigger/trigger-chat-agent.ts`) — before a lesson is accepted, a deterministic red-flag scan **and** a parallel set of cheap LLM screeners (distinct adversarial lenses: exfiltration, social-engineering) vet the HTML. A flag fails the `renderVisualization` tool, so the model regenerates a clean lesson through the normal retry loop. Set `LESSON_SCREENING=off` to skip the LLM fan-out and rely on the scan + sandbox + CSP alone.

The same catalog generates the system-prompt component reference and validates tool calls, so the prompt and the renderer can't drift apart.

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

- "What is Trigger.dev, and how does it work?" — a ground-up explainer
- "Teach me retries properly" — a full interactive lesson with a quiz
- "How does a fan-out with retries work?" — an interactive FlowGraph
- "How does a run survive a redeploy?" — checkpoints, drawn
- "Suggest more topics" — the agent proposes a fresh set, grounded in the docs

Then follow the next-step chips under each answer to keep going.

## Deploy

```sh
pnpm deploy:trigger
```

Make sure `ANTHROPIC_API_KEY` (and optionally `DOCS_MCP_URL`) are set for the Prod environment in the dashboard, and deploy the Next.js app anywhere with `TRIGGER_SECRET_KEY` (prod) set.
