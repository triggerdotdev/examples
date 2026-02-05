# Cursor Agent Runner

Run Cursor's CLI agent on [Trigger.dev](https://trigger.dev), streamed live to a terminal UI.

Type a prompt, pick a model, and watch the agent create files and write code from scratch in real time.

## How it works

1. User types a prompt in the browser (e.g. "Create a TypeScript CLI that converts CSV to JSON")
2. Next.js API route triggers a Trigger.dev task
3. The task spawns `cursor-agent` in an empty workspace
4. NDJSON output from stdout is parsed and piped to a Realtime Stream
5. `useRealtimeRunWithStreams` renders each event live in a terminal panel

```text
[Browser] <-- Realtime Streams v2 --> [Trigger.dev Cloud]
    |                                        |
    | POST /api/trigger                      | task.trigger()
    |                                        |
    +--- Next.js API route ------------------+
                                             |
                                    cursor-agent child process
                                    stdout -> NDJSON -> stream
```

## Key concepts demonstrated

- **Build extensions** — install any system binary (cursor-agent) into the task container via `addLayer`
- **Realtime Streams v2** — pipe NDJSON from a child process directly to the browser
- **Long-running tasks** — cursor-agent runs for minutes; Trigger.dev handles lifecycle, timeouts, retries
- **Machine selection** — `medium-2x` for resource-intensive CLI tools

## Setup

```bash
# Install dependencies
pnpm install

# Copy env template and fill in values
cp env.local.example .env.local
```

Required environment variables:

| Variable | Description |
|----------|-------------|
| `TRIGGER_SECRET_KEY` | Your Trigger.dev secret key (starts with `tr_dev_` or `tr_`) |
| `TRIGGER_PROJECT_REF` | Your Trigger.dev project ref (starts with `proj_`) |
| `CURSOR_API_KEY` | Your Cursor API key for headless CLI access |

## Run locally

```bash
# Start Next.js dev server
pnpm dev

# In another terminal, start Trigger.dev dev
npx trigger.dev dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Trigger.dev Cloud

```bash
npx trigger.dev deploy
```

The build extension in `trigger.config.ts` installs `cursor-agent` into the container image automatically.

## Project structure

```text
├── app/
│   ├── layout.tsx              # Root layout with Geist fonts
│   ├── page.tsx                # Main UI: control bar + terminal
│   └── api/trigger/route.ts    # Trigger task, return run ID
├── components/
│   ├── terminal.tsx            # Realtime terminal with auto-scroll
│   ├── cursor-event.tsx        # Render each NDJSON event type
│   └── control-bar.tsx         # Prompt input, model select, run button
├── trigger/
│   └── cursor-agent.ts         # The task: spawn CLI, stream NDJSON
├── lib/
│   └── cursor-events.ts        # TypeScript types for cursor events
├── trigger.config.ts           # Build extension for cursor CLI binary
└── env.local.example           # Env var template
```

## Links

- [Trigger.dev Build Extensions docs](https://trigger.dev/docs/config/extensions/custom)
- [Trigger.dev Realtime Streams docs](https://trigger.dev/docs/realtime)
- [Cursor CLI Output Format](https://cursor.com/docs/cli/reference/output-format)

## Stack

Next.js 16 · Trigger.dev v4 · Tailwind CSS · Geist Mono
