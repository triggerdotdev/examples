"use client"

import { useState } from "react"
import type { Story } from "@/trigger/streams"

type StoryStatus = "pending" | "in_progress" | "done"

type Props = {
  story: Story
  status: StoryStatus
  diff?: string
  onEdit?: (story: Story) => void
}

export function StoryCard({ story, status, diff, onEdit }: Props) {
  const [isDiffOpen, setIsDiffOpen] = useState(false)

  const indicator = {
    pending: { icon: "○", color: "text-slate-400" },
    in_progress: { icon: "●", color: "text-blue-500" },
    done: { icon: "✓", color: "text-emerald-500" },
  }[status]

  const cardStyle = {
    pending: "bg-white border-slate-200 hover:border-slate-300 shadow-sm",
    in_progress: "bg-blue-50/50 border-blue-200 shadow-sm shadow-blue-100",
    done: "bg-slate-50 border-slate-200 shadow-sm",
  }[status]

  return (
    <div className={`rounded-md border p-4 ${cardStyle} transition-colors`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <span className={`text-base ${indicator.color}`}>{indicator.icon}</span>
        <span className="text-[11px] text-slate-400 font-mono tracking-wide">{story.id}</span>
        {status === "in_progress" && (
          <span className="ml-auto text-[11px] text-blue-500 font-medium animate-pulse">
            working
          </span>
        )}
      </div>

      {/* Title */}
      <h4 className={`text-[13px] font-medium leading-snug mb-3 ${
        status === "done" ? "text-slate-500" : "text-slate-800"
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
      <div className="flex gap-2 pt-2 border-t border-slate-100">
        {status === "pending" && onEdit && (
          <button
            onClick={() => onEdit(story)}
            className="text-[11px] px-2 py-1 rounded border border-slate-300 text-slate-500 hover:text-slate-700 hover:border-slate-400 transition-colors"
          >
            Edit
          </button>
        )}
        {status === "done" && diff && (
          <button
            onClick={() => setIsDiffOpen(!isDiffOpen)}
            className="text-[11px] text-slate-500 hover:text-slate-700 font-medium flex items-center gap-1"
          >
            Diff {isDiffOpen ? "▲" : "▼"}
          </button>
        )}
      </div>

      {/* Diff viewer (collapsed by default) */}
      {isDiffOpen && diff && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <pre className="text-[10px] font-mono text-slate-600 bg-slate-100 p-2 rounded overflow-x-auto max-h-48 whitespace-pre">
            {diff}
          </pre>
        </div>
      )}
    </div>
  )
}
