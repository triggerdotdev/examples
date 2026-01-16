# realtime streams examples

Interactive split-screen code viewer showcasing Trigger.dev Realtime Streams v2 patterns.

## overview

Learn Trigger.dev Realtime Streams by seeing the code alongside a live demo. Click UI elements to highlight the corresponding code. Watch progress updates stream from background tasks to your browser in real-time.

## tech stack

- [**next.js**](https://nextjs.org/) – react framework with app router
- [**trigger.dev**](https://trigger.dev/docs) – background task orchestration
- [**trigger.dev react hooks**](https://trigger.dev/docs/frontend/react-hooks) – realtime frontend subscriptions
- [**shiki**](https://shiki.style/) – syntax highlighting
- [**tailwind css**](https://tailwindcss.com/) + [**shadcn/ui**](https://ui.shadcn.com/) – styling

## setup & running locally

1. Clone the repo:
   ```bash
   git clone https://github.com/triggerdotdev/realtime-streams-examples
   cd realtime-streams-examples
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Create `.env` with your Trigger.dev secret key:
   ```bash
   # Get from: https://cloud.trigger.dev → Project → API Keys
   TRIGGER_SECRET_KEY=tr_dev_...
   ```

4. Update `trigger.config.ts` with your project ref:
   ```ts
   project: "proj_xxxxx", // from Trigger.dev dashboard
   ```

5. Run both dev servers:
   ```bash
   # Terminal 1: Next.js
   pnpm dev

   # Terminal 2: Trigger.dev worker
   pnpm dev:trigger
   ```

6. Open [http://localhost:3000](http://localhost:3000)

## how it works

The progress tracking example demonstrates Trigger.dev Realtime Streams:

1. **Trigger task** – Server action calls `tasks.trigger()` with a scoped public token
2. **Background processing** – Task runs in Trigger.dev, calling `progressStream.append()` on each step
3. **Realtime updates** – Frontend subscribes via `useRealtimeStream()` hook, receives updates instantly

```
┌─────────────┐     ┌────────────────┐     ┌─────────────┐
│   Browser   │────▶│  Server Action │────▶│ Trigger.dev │
│             │     │  tasks.trigger │     │    Task     │
└─────────────┘     └────────────────┘     └──────┬──────┘
       ▲                                          │
       │         progressStream.append()          │
       └──────────────────────────────────────────┘
              useRealtimeStream() subscription
```

## relevant code

| Feature | File |
|---------|------|
| Stream definition | [`src/trigger/streams.ts`](src/trigger/streams.ts) |
| Background task | [`src/trigger/tasks.ts`](src/trigger/tasks.ts) |
| Server action (trigger + token) | [`src/app/examples/progress-tracking/actions.ts`](src/app/examples/progress-tracking/actions.ts) |
| Realtime UI | [`src/app/examples/progress-tracking/progress-demo.tsx`](src/app/examples/progress-tracking/progress-demo.tsx) |
| Code highlighting panel | [`src/components/code-panel.tsx`](src/components/code-panel.tsx) |
| Click-to-highlight mapping | [`src/lib/code-mappings.ts`](src/lib/code-mappings.ts) |

## learn more

- [**trigger.dev realtime**](https://trigger.dev/docs/realtime) – streams overview
- [**trigger.dev react hooks**](https://trigger.dev/docs/frontend/react-hooks) – useRealtimeStream and more
- [**public access tokens**](https://trigger.dev/docs/frontend/overview#authentication) – scoped frontend auth
