import { streams, InferStreamType } from "@trigger.dev/sdk"

// Status updates for clone, agent loop, etc.
export const statusStream = streams.define<{
  type: "cloning" | "cloned" | "working" | "iteration" | "complete" | "error"
  message: string
  iteration?: number
}>({
  id: "status",
})

// Agent output stream for Claude responses
export const agentOutputStream = streams.define<string>({
  id: "agent-output",
})

export type StatusStreamPart = InferStreamType<typeof statusStream>
export type AgentOutputStreamPart = InferStreamType<typeof agentOutputStream>
