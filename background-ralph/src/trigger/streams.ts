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
  files: string[]  // Paths this story will create or modify
  context?: string  // Research summary: versions, imports, patterns, warnings
  passes?: boolean
}

// Alias for component usage
export type Story = PrdStory

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
    | "prd_planning"
    | "prd_generated"
    | "prd_review"
    | "working"
    | "iteration"
    | "story_start"
    | "story_complete"
    | "story_failed"
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
  storyError?: string
  iteration?: number
  diff?: string
  branchUrl?: string
  prUrl?: string
  prTitle?: string
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
    diff?: string // Per-story git diff
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

// Chat message types for structured output
export type ChatMessage =
  | { type: "thinking"; delta: string }
  | { type: "text"; delta: string }
  | { type: "status"; message: string; phase: "cloning" | "exploring" | "planning" }
  | { type: "tool_start"; id: string; name: string; file?: string; command?: string }
  | { type: "tool_input"; id: string; delta: string }
  | { type: "tool_end"; id: string }
  | { type: "story_separator"; storyNum: number; totalStories: number; title: string }
  | { type: "approval"; id: string; tokenId: string; publicAccessToken: string; question: string; variant: "story" | "prd"; createdAt: number; timeoutMs: number }
  | { type: "approval_response"; id: string; action: string }
  | { type: "complete"; prUrl?: string; prTitle?: string; branchUrl?: string; error?: string }

// Agent output stream for Claude responses (now carries NDJSON ChatMessages)
export const agentOutputStream = streams.define<string>({
  id: "agent-output",
})

// Helper to append chat message (JSON stringify + newline)
export async function appendChatMessage(msg: ChatMessage) {
  await agentOutputStream.append(JSON.stringify(msg) + "\n")
}

export type StatusStreamPart = InferStreamType<typeof statusStream>
export type AgentOutputStreamPart = InferStreamType<typeof agentOutputStream>
