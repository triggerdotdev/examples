import { streams, InferStreamType } from "@trigger.dev/sdk"

// Token usage tracking
export type TokenUsage = {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
}

// PRD story type (what Claude generates)
export type PrdStory = {
  id: string
  title: string
  acceptance: string[]
  dependencies: string[]
  passes?: boolean
}

export type Prd = {
  name: string
  description: string
  stories: PrdStory[]
}

// Status object type
export type StatusUpdate = {
  type:
    | "cloning"
    | "cloned"
    | "installing"
    | "exploring"
    | "prd_generated"
    | "prd_review"
    | "working"
    | "iteration"
    | "story_start"
    | "story_complete"
    | "diff"
    | "pushing"
    | "pushed"
    | "push_failed"
    | "complete"
    | "error"
    | "waitpoint"
    | "agent_complete"
    | "user_approved"
    | "tests_passed"
    | "tests_failed"
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
  prd?: Prd
  story?: {
    id: string
    current: number
    total: number
    title: string
    acceptance: string[]
  }
  commitHash?: string
  commitUrl?: string
  progress?: string // In-memory progress log (Ralph loop pattern)
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
