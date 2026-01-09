import { streams, InferStreamType } from "@trigger.dev/sdk"

// Status updates for clone, agent loop, etc.
export const statusStream = streams.define<{
  type: "cloning" | "cloned" | "working" | "iteration" | "diff" | "pushing" | "pushed" | "push_failed" | "complete" | "error"
  message: string
  iteration?: number
  diff?: string
  branchUrl?: string
}>({
  id: "status",
})

// Agent output stream for Claude responses
export const agentOutputStream = streams.define<string>({
  id: "agent-output",
})

export type StatusStreamPart = InferStreamType<typeof statusStream>
export type AgentOutputStreamPart = InferStreamType<typeof agentOutputStream>
