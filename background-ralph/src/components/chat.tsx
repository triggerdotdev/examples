"use client"

import { useRef, useEffect, useState, useMemo } from "react"
import { useRealtimeStream } from "@trigger.dev/react-hooks"
import { Streamdown } from "streamdown"
import { agentOutputStream, type ChatMessage } from "@/trigger/streams"

type Props = {
  runId: string
  accessToken: string
}

// Parsed message block for rendering
type MessageBlock =
  | { type: "thinking"; content: string }
  | { type: "text"; content: string }
  | { type: "tool"; id: string; name: string; input: string; complete: boolean }
  | { type: "story_separator"; storyNum: number; totalStories: number; title: string }

// Parse NDJSON output into structured message blocks
function parseMessages(raw: string): MessageBlock[] {
  const lines = raw.split("\n").filter(Boolean)
  const blocks: MessageBlock[] = []
  const toolBlocks = new Map<string, { name: string; input: string; complete: boolean }>()

  let currentThinking = ""
  let currentText = ""

  const flushThinking = () => {
    if (currentThinking) {
      blocks.push({ type: "thinking", content: currentThinking })
      currentThinking = ""
    }
  }

  const flushText = () => {
    if (currentText) {
      blocks.push({ type: "text", content: currentText })
      currentText = ""
    }
  }

  for (const line of lines) {
    try {
      const msg = JSON.parse(line) as ChatMessage

      switch (msg.type) {
        case "thinking":
          flushText()
          currentThinking += msg.delta
          break

        case "text":
          flushThinking()
          currentText += msg.delta
          break

        case "tool_start":
          flushThinking()
          flushText()
          toolBlocks.set(msg.id, { name: msg.name, input: "", complete: false })
          break

        case "tool_input":
          const tool = toolBlocks.get(msg.id)
          if (tool) {
            tool.input += msg.delta
          }
          break

        case "tool_end":
          const endTool = toolBlocks.get(msg.id)
          if (endTool) {
            endTool.complete = true
            blocks.push({
              type: "tool",
              id: msg.id,
              name: endTool.name,
              input: endTool.input,
              complete: true,
            })
            toolBlocks.delete(msg.id)
          }
          break

        case "story_separator":
          flushThinking()
          flushText()
          blocks.push({
            type: "story_separator",
            storyNum: msg.storyNum,
            totalStories: msg.totalStories,
            title: msg.title,
          })
          break
      }
    } catch {
      // Invalid JSON line, skip
    }
  }

  // Flush remaining
  flushThinking()
  flushText()

  // Add incomplete tool blocks
  for (const [id, tool] of toolBlocks) {
    blocks.push({
      type: "tool",
      id,
      name: tool.name,
      input: tool.input,
      complete: false,
    })
  }

  return blocks
}

// Tool icon based on name
function getToolIcon(name: string): string {
  switch (name) {
    case "Read": return "📖"
    case "Write": return "✏️"
    case "Edit": return "📝"
    case "Bash": return "⚡"
    case "Grep": return "🔍"
    case "Glob": return "📁"
    default: return "🔧"
  }
}

// Extract file path or command from tool input
function getToolSummary(name: string, input: string): string {
  try {
    const parsed = JSON.parse(input)
    if (name === "Bash" && parsed.command) {
      return parsed.command.slice(0, 60) + (parsed.command.length > 60 ? "..." : "")
    }
    if (parsed.file_path) {
      return parsed.file_path.split("/").pop() ?? parsed.file_path
    }
    if (parsed.path) {
      return parsed.path.split("/").pop() ?? parsed.path
    }
    if (parsed.pattern) {
      return parsed.pattern
    }
  } catch {
    // Incomplete JSON, try to extract path
    const pathMatch = input.match(/"(?:file_)?path":\s*"([^"]+)/)
    if (pathMatch) return pathMatch[1].split("/").pop() ?? pathMatch[1]
    const cmdMatch = input.match(/"command":\s*"([^"]+)/)
    if (cmdMatch) return cmdMatch[1].slice(0, 60)
  }
  return ""
}

function ToolBlock({ name, input, complete }: { name: string; input: string; complete: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const summary = getToolSummary(name, input)

  return (
    <div className="my-2 border border-slate-700 rounded bg-slate-900/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-slate-800/50 transition-colors"
      >
        <span className="text-[12px]">{getToolIcon(name)}</span>
        <span className="text-[12px] font-medium text-slate-300">{name}</span>
        {summary && (
          <span className="text-[11px] text-slate-500 font-mono truncate flex-1">
            {summary}
          </span>
        )}
        {!complete && (
          <span className="text-[10px] text-blue-400 animate-pulse">running...</span>
        )}
        <span className="text-[10px] text-slate-600">
          {expanded ? "▲" : "▼"}
        </span>
      </button>
      {expanded && input && (
        <pre className="px-3 py-2 text-[10px] font-mono text-slate-400 border-t border-slate-700 overflow-x-auto max-h-[200px] overflow-y-auto">
          {input}
        </pre>
      )}
    </div>
  )
}

export function Chat({ runId, accessToken }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isAutoScroll, setIsAutoScroll] = useState(true)

  const { parts: outputParts } = useRealtimeStream(agentOutputStream, runId, {
    accessToken,
  })

  const rawOutput = outputParts?.join("") ?? ""
  const blocks = useMemo(() => parseMessages(rawOutput), [rawOutput])

  // Auto-scroll when new content arrives (if not paused)
  useEffect(() => {
    if (isAutoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [blocks, isAutoScroll])

  // Pause auto-scroll on user scroll up
  function handleScroll() {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    setIsAutoScroll(isAtBottom)
  }

  if (blocks.length === 0) {
    return (
      <div className="p-4 text-[11px] text-muted-foreground">
        Waiting for agent...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Agent
        </span>
        {!isAutoScroll && (
          <button
            onClick={() => setIsAutoScroll(true)}
            className="text-[10px] text-blue-400 hover:text-blue-300"
          >
            Resume scroll
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
      >
        {blocks.map((block, i) => {
          switch (block.type) {
            case "thinking":
              return (
                <div
                  key={i}
                  className="text-[11px] font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap"
                >
                  {block.content}
                </div>
              )

            case "text":
              return (
                <div
                  key={i}
                  className="prose prose-sm prose-invert max-w-none text-[13px] leading-relaxed prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800 prose-pre:text-[11px] prose-code:text-slate-300"
                >
                  <Streamdown>{block.content}</Streamdown>
                </div>
              )

            case "tool":
              return (
                <ToolBlock
                  key={block.id}
                  name={block.name}
                  input={block.input}
                  complete={block.complete}
                />
              )

            case "story_separator":
              return (
                <div
                  key={i}
                  className="py-3 flex items-center gap-3"
                >
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Story {block.storyNum}/{block.totalStories}: {block.title}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )
          }
        })}
      </div>
    </div>
  )
}
