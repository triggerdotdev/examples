/**
 * Helper functions for streaming agent output to chat
 */
import type { ChatMessage, TokenUsage } from "./streams"

// Types for agent SDK stream events (not exported from SDK)
type StreamDelta =
  | { type: "text_delta"; text: string }
  | { type: "thinking_delta"; thinking: string }
  | { type: "input_json_delta"; partial_json: string }

type ContentBlock =
  | { type: "tool_use"; id: string; name: string }
  | { type: "text" }
  | { type: "thinking" }

type StreamEvent =
  | { type: "content_block_start"; content_block: ContentBlock }
  | { type: "content_block_delta"; delta: StreamDelta }
  | { type: "content_block_stop" }

// Agent message types from query() AsyncIterable
type AgentMessageUsage = {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

type AgentMessage =
  | { type: "assistant"; message: { usage?: AgentMessageUsage } }
  | { type: "stream_event"; event: StreamEvent }
  | { type: "result"; subtype: "success"; result: string }
  | { type: "result"; subtype: "error" | "cancelled" | "interrupted" | "max_turns" }

/**
 * Streams agent messages to chat as NDJSON, accumulating token usage.
 * Returns the final text result if agent succeeds.
 *
 * Used by both PRD generation and story execution to avoid duplicating
 * the 60-line stream handling logic.
 */
export async function streamAgentToChat(
  agentResult: AsyncIterable<AgentMessage>,
  write: (msg: string) => void,
  usage?: TokenUsage
): Promise<string | undefined> {
  let finalResult: string | undefined
  let currentToolId: string | undefined

  for await (const message of agentResult) {
    // Track token usage from assistant messages
    if (message.type === "assistant" && usage) {
      const msgUsage = message.message.usage
      if (msgUsage) {
        usage.inputTokens += msgUsage.input_tokens ?? 0
        usage.outputTokens += msgUsage.output_tokens ?? 0
        usage.cacheReadTokens += msgUsage.cache_read_input_tokens ?? 0
        usage.cacheCreationTokens += msgUsage.cache_creation_input_tokens ?? 0
      }
    }

    if (message.type === "stream_event") {
      const event = message.event as StreamEvent

      // Content block start - track tool use
      if (event.type === "content_block_start") {
        const block = event.content_block
        if (block.type === "tool_use") {
          currentToolId = block.id
          const toolMsg: ChatMessage = {
            type: "tool_start",
            id: block.id,
            name: block.name,
          }
          write(JSON.stringify(toolMsg) + "\n")
        }
      }

      // Content block delta - text or tool input
      if (event.type === "content_block_delta") {
        const delta = event.delta
        if (delta.type === "text_delta") {
          const textMsg: ChatMessage = { type: "text", delta: delta.text }
          write(JSON.stringify(textMsg) + "\n")
        } else if (delta.type === "thinking_delta") {
          const thinkMsg: ChatMessage = { type: "thinking", delta: delta.thinking }
          write(JSON.stringify(thinkMsg) + "\n")
        } else if (delta.type === "input_json_delta" && currentToolId) {
          const inputMsg: ChatMessage = {
            type: "tool_input",
            id: currentToolId,
            delta: delta.partial_json,
          }
          write(JSON.stringify(inputMsg) + "\n")
        }
      }

      // Content block stop - mark tool complete
      if (event.type === "content_block_stop" && currentToolId) {
        const endMsg: ChatMessage = { type: "tool_end", id: currentToolId }
        write(JSON.stringify(endMsg) + "\n")
        currentToolId = undefined
      }
    }

    if (message.type === "result") {
      if (message.subtype === "success") {
        finalResult = message.result
      }
    }
  }

  return finalResult
}
