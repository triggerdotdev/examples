"use client"

import { useState } from "react"
import type { Story } from "@/trigger/streams"

type StoryStatus = "pending" | "in_progress" | "done" | "failed"

type Props = {
  story: Story
  status: StoryStatus
  diff?: string
  error?: string
  onEdit?: (story: Story) => void
  onRetry?: (story: Story) => void
}

export function StoryCard({ story, status, diff, error, onEdit, onRetry }: Props) {
  const [isDiffOpen, setIsDiffOpen] = useState(false)
  const [isErrorOpen, setIsErrorOpen] = useState(false)
  const [isJsonOpen, setIsJsonOpen] = useState(false)

  const indicator = {
    pending: { icon: "○", color: "text-slate-400" },
    in_progress: { icon: "●", color: "text-blue-500" },
    done: { icon: "✓", color: "text-emerald-500" },
    failed: { icon: "✕", color: "text-red-500" },
  }[status]

  const cardStyle = {
    pending: "bg-white border-slate-200 hover:border-slate-300 shadow-sm",
    in_progress: "bg-blue-50/50 border-blue-200 shadow-sm shadow-blue-100",
    done: "bg-slate-50 border-slate-200 shadow-sm",
    failed: "bg-red-50/50 border-red-200 shadow-sm shadow-red-100",
  }[status]

  return (
    <div className={`rounded-md border p-4 ${cardStyle} transition-colors`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <span className={`text-base ${indicator.color}`}>{indicator.icon}</span>
        <span className="text-[11px] text-slate-400 font-mono tracking-wide">{story.id}</span>
        <div className="ml-auto flex items-center gap-2">
          {status === "in_progress" && (
            <span className="text-[11px] text-blue-500 font-medium animate-pulse">
              working
            </span>
          )}
          {status === "failed" && (
            <span className="text-[11px] text-red-500 font-medium">
              failed
            </span>
          )}
          <button
            onClick={() => setIsJsonOpen(!isJsonOpen)}
            className="text-[10px] px-1.5 py-0.5 rounded border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-colors font-mono"
            title="View JSON"
          >
            {"{}"}
          </button>
        </div>
      </div>

      {/* Title */}
      <h4 className={`text-[13px] font-medium leading-snug mb-3 ${
        status === "done" ? "text-slate-500" : status === "failed" ? "text-red-800" : "text-slate-800"
      }`}>
        {story.title}
      </h4>

      {/* Acceptance criteria */}
      <ul className="space-y-1 mb-3">
        {story.acceptance.slice(0, 2).map((criterion, i) => (
          <li key={i} className="text-[12px] text-slate-600 truncate leading-relaxed">
            <span className="text-slate-400 mr-1.5">•</span>
            {criterion}
          </li>
        ))}
        {story.acceptance.length > 2 && (
          <li className="text-[12px] text-slate-500 pt-0.5">
            +{story.acceptance.length - 2} more
          </li>
        )}
      </ul>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-slate-100 flex-wrap">
        {status === "pending" && onEdit && (
          <button
            onClick={() => onEdit(story)}
            className="text-[11px] px-2.5 py-1 min-h-6 rounded border border-slate-300 text-slate-500 hover:text-slate-700 hover:border-slate-400 transition-colors font-medium"
          >
            Edit
          </button>
        )}
        {status === "failed" && onRetry && (
          <button
            onClick={() => onRetry(story)}
            title="Re-run this story (start a new run)"
            className="text-[11px] px-2.5 py-1 min-h-6 rounded border-2 border-yellow-300 bg-yellow-200 text-yellow-900 hover:bg-yellow-300 transition-colors font-medium"
          >
            Retry
          </button>
        )}
        {status === "failed" && error && (
          <button
            onClick={() => setIsErrorOpen(!isErrorOpen)}
            className="text-[11px] px-2.5 py-1 min-h-6 rounded border-2 border-rose-300 bg-rose-200 text-rose-900 hover:bg-rose-300 font-medium flex items-center gap-1 transition-colors"
          >
            Error {isErrorOpen ? "▲" : "▼"}
          </button>
        )}
        {status === "done" && diff && (
          <button
            onClick={() => setIsDiffOpen(!isDiffOpen)}
            className="text-[11px] px-2.5 py-1 min-h-6 rounded border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 font-medium flex items-center gap-1 transition-colors"
          >
            Diff {isDiffOpen ? "▲" : "▼"}
          </button>
        )}
      </div>

      {/* Error viewer (collapsed by default) */}
      {isErrorOpen && error && (
        <div className="mt-3 pt-3 border-t border-red-100">
          <pre className="text-[10px] font-mono text-red-700 bg-red-100 p-2 rounded overflow-x-auto max-h-48 whitespace-pre-wrap">
            {error}
          </pre>
        </div>
      )}

      {/* Diff viewer (collapsed by default) */}
      {isDiffOpen && diff && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <pre className="text-[10px] font-mono text-slate-600 bg-slate-100 p-2 rounded overflow-x-auto max-h-48 whitespace-pre">
            {diff}
          </pre>
        </div>
      )}

      {/* JSON viewer (collapsed by default) */}
      {isJsonOpen && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-slate-500 font-medium">Story JSON</span>
            <button
              onClick={() => navigator.clipboard.writeText(JSON.stringify(story, null, 2))}
              className="text-[10px] text-slate-400 hover:text-slate-600"
            >
              Copy
            </button>
          </div>
          <pre className="text-[10px] font-mono text-slate-600 bg-slate-100 p-2 rounded overflow-x-auto max-h-48 whitespace-pre">
            {JSON.stringify(story, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
