import { task } from "@trigger.dev/sdk"

export type RalphLoopPayload = {
  repoUrl: string
  prompt: string
  githubToken?: string
}

export const ralphLoop = task({
  id: "ralph-loop",
  maxDuration: 3600,
  run: async (payload: RalphLoopPayload) => {
    console.log("Starting ralph-loop", { repoUrl: payload.repoUrl })

    // TODO US-003: Clone repo
    // TODO US-004: Claude Agent SDK loop
    // TODO US-005: Commit and push
    // TODO US-006: Realtime streaming

    return { success: true, message: "Task skeleton ready" }
  },
})
