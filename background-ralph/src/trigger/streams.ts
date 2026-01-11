import { streams, InferStreamType } from "@trigger.dev/sdk"

// Token usage tracking
export type TokenUsage = {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
}

// Status object type
export type StatusUpdate = {
  type: "cloning" | "cloned" | "working" | "iteration" | "diff" | "pushing" | "pushed" | "push_failed" | "complete" | "error" | "waitpoint"
  message: string
  iteration?: number
  diff?: string
  branchUrl?: string
  prUrl?: string
  waitpoint?: {
    tokenId: string
    publicAccessToken: string
    question: string
  }
  usage?: TokenUsage
}

// Status updates - use string stream with manual JSON serialization
export const statusStream = streams.define<string>({
  id: "status",
})

// Helper to append status (JSON stringify)
export async function appendStatus(status: StatusUpdate) {
  await statusStream.append(JSON.stringify(status))
}

// Agent output stream for Claude responses
export const agentOutputStream = streams.define<string>({
  id: "agent-output",
})

export type StatusStreamPart = InferStreamType<typeof statusStream>
export type AgentOutputStreamPart = InferStreamType<typeof agentOutputStream>
