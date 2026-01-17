"use client"

import { useState, useEffect } from "react"
import Editor from "react-simple-code-editor"
import { highlight, languages } from "prismjs"
import "prismjs/components/prism-json"
import "prismjs/themes/prism.css"
import type { Prd } from "@/trigger/streams"

type Props = {
  prd: Prd | null
  completedStoryIds: Set<string>
  failedStoryIds: Set<string>
  currentStoryId?: string
  onPrdChange?: (prd: Prd) => void
  readOnly?: boolean
}

export function PrdJsonEditor({
  prd,
  completedStoryIds,
  failedStoryIds,
  currentStoryId,
  onPrdChange,
  readOnly = false,
}: Props) {
  const [jsonText, setJsonText] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Merge server PRD with completion status
  const displayPrd = prd
    ? {
        ...prd,
        stories: prd.stories.map((s) => ({
          ...s,
          passes: completedStoryIds.has(s.id) ? true : s.passes,
          _status: completedStoryIds.has(s.id)
            ? "done"
            : failedStoryIds.has(s.id)
              ? "failed"
              : s.id === currentStoryId
                ? "in_progress"
                : "pending",
        })),
      }
    : null

  // Update text when PRD changes from server
  const displayPrdJson = displayPrd ? JSON.stringify(displayPrd, null, 2) : ""
  useEffect(() => {
    if (displayPrdJson) {
      setJsonText(displayPrdJson)
      setError(null)
    }
  }, [displayPrdJson])

  function handleChange(value: string) {
    setJsonText(value)

    try {
      const parsed = JSON.parse(value) as Prd
      if (!parsed.name || !parsed.stories || !Array.isArray(parsed.stories)) {
        setError("Invalid PRD: missing name or stories")
        return
      }
      setError(null)
      onPrdChange?.(parsed)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON")
    }
  }

  if (!prd) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-[12px]">
        <div className="text-center space-y-2">
          <p className="text-[16px]">{ }</p>
          <p>PRD will appear here</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50">
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
          PRD JSON
        </span>
        <div className="flex items-center gap-2">
          {error && (
            <span className="text-[10px] text-red-500 font-medium">
              {error}
            </span>
          )}
          <span className="text-[10px] text-slate-400">
            {completedStoryIds.size}/{prd.stories.length} done
          </span>
        </div>
      </div>
      <div className={`flex-1 overflow-auto ${error ? "bg-red-50" : "bg-white"}`}>
        <Editor
          value={jsonText}
          onValueChange={handleChange}
          highlight={(code) => highlight(code, languages.json, "json")}
          disabled={readOnly}
          padding={12}
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 11,
            lineHeight: 1.6,
            minHeight: "100%",
          }}
          className={readOnly ? "opacity-70" : ""}
        />
      </div>
    </div>
  )
}
