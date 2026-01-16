# AI Agents with Trigger.dev v4

Auto-read when building AI agents or background tasks.

## Before Starting

1. Check trigger.dev/docs for current patterns (web search)
2. Choose complexity level:
   - Simple → Single task
   - Multi-step → Prompt chaining
   - Parallel work → Batch operations
   - User feedback → Waitpoints

## Task Setup

```ts
import { task } from '@trigger.dev/sdk/v3'

export const myTask = task({
  id: 'my-task',
  maxDuration: 300, // Always set this
  run: async (payload) => {
    // Task logic
  },
})
```

## Realtime Streams v2 (SDK 4.1.0+)

```ts
// trigger/streams.ts
import { streams } from '@trigger.dev/sdk/v3'
export const outputStream = streams.define<string>({ id: 'output' })

// In task
await outputStream.pipe(result.textStream)

// Frontend
import { useRealtimeStream } from '@trigger.dev/react-hooks'
const { parts } = useRealtimeStream(outputStream, runId, { accessToken })
```

## Human-in-the-Loop (Waitpoints)

```ts
import { wait } from '@trigger.dev/sdk/v3'

const token = await wait.createToken({ timeout: '24h' })
// Send token to user...
const result = await wait.forToken<{ approved: boolean }>(token)
```

## Common Mistakes

- ❌ Not setting maxDuration
- ❌ Using old metadata.stream() — use streams.define()
- ❌ SDK < 4.1.0 for Realtime Streams v2
- ❌ Overcomplicating — start with single task, add complexity only when needed
