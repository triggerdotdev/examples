# Next.js + Trigger.dev Hello World

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/triggerdotdev/trigger-nextjs-hello-world.js)

A minimal Next.js app that triggers a background task from an API route. Click a button, fire a task, watch it run on [Trigger.dev](https://trigger.dev).

The whole thing is ~20 lines of task code in `trigger/hello-world.ts`.

## How it works

1. The frontend calls `POST /api/hello`
2. The API route triggers the `hello-world` task using the Trigger.dev SDK
3. The task runs on Trigger.dev's infrastructure (with retries, logging, the works)

## Local dev

```bash
cp .env.example .env.local
# Add your TRIGGER_SECRET_KEY from cloud.trigger.dev
pnpm install
pnpm dev          # Next.js on :3000
npx trigger dev   # Trigger.dev dev server
```

## Deploy to Vercel

Click the deploy button above, then install the [Trigger.dev Vercel integration](https://vercel.com/integrations/trigger-dev) to automatically sync your environment variables.

## Learn more

- [Quick start](https://trigger.dev/docs/quick-start)
- [Writing tasks](https://trigger.dev/docs/tasks/overview)
- [Realtime](https://trigger.dev/docs/realtime)
- [Scheduled tasks](https://trigger.dev/docs/tasks/scheduled)
