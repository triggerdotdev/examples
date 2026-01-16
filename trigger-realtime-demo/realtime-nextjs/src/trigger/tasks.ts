import { task } from "@trigger.dev/sdk/v3"
import { progressStream } from "./streams"

export const processDataTask = task({
  id: "process-data",
  maxDuration: 300,
  run: async (payload: { items: number }) => {
    const total = payload.items

    for (let i = 0; i < total; i++) {
      // Simulate work
      await new Promise((r) => setTimeout(r, 500))

      // Stream progress update
      await progressStream.append({
        current: i + 1,
        total,
        message: `Processing item ${i + 1} of ${total}`,
      })
    }

    return { processed: total }
  },
})
