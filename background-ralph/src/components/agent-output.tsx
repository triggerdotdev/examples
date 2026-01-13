"use client"

import { useRef, useEffect, useState } from "react"
import { Streamdown } from "streamdown"

type Props = {
  content: string
}

export function AgentOutput({ content }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isAutoScroll, setIsAutoScroll] = useState(true)

  // Auto-scroll when new content arrives (if not paused)
  useEffect(() => {
    if (isAutoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [content, isAutoScroll])

  // Pause auto-scroll on user interaction
  function handleScroll() {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    setIsAutoScroll(isAtBottom)
  }

  if (isCollapsed) {
    return (
      <div className="border border-slate-800 rounded-md bg-slate-950 px-4 py-3">
        <button
          onClick={() => setIsCollapsed(false)}
          className="text-[13px] text-slate-400 hover:text-slate-200 flex items-center gap-2"
        >
          <span>Agent output</span>
          <span className="text-[11px]">▼</span>
        </button>
      </div>
    )
  }

  return (
    <div className="border border-slate-800 rounded-md bg-slate-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
          Agent output
        </span>
        <div className="flex items-center gap-4">
          {!isAutoScroll && (
            <button
              onClick={() => setIsAutoScroll(true)}
              className="text-[11px] text-blue-400 hover:text-blue-300 font-medium"
            >
              Resume scroll
            </button>
          )}
          <button
            onClick={() => setIsCollapsed(true)}
            className="text-[11px] text-slate-600 hover:text-slate-400"
          >
            ▲
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="p-4 min-h-[200px] max-h-[500px] overflow-auto scrollbar-thin"
      >
        {content ? (
          <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800 prose-pre:rounded-md prose-code:text-slate-300">
            <Streamdown>{content}</Streamdown>
          </div>
        ) : (
          <p className="text-[13px] text-slate-600">
            Waiting for agent output...
          </p>
        )}
      </div>
    </div>
  )
}
