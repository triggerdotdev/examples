"use client"

import { useState, useCallback, useEffect } from "react"
import { useRealtimeRun, useRealtimeStream } from "@trigger.dev/react-hooks"
import { statusStream, type Prd } from "@/trigger/streams"
import { PrdJsonEditor } from "./prd-json-editor"
import { ProgressLog } from "./progress-log"
import type { ralphLoop } from "@/trigger/ralph-loop"
import {
  parseStatusParts,
  extractPrdFromStatus,
  extractCompletedStories,
  extractFailedStories,
  getCurrentStoryId,
  getLatestProgress,
} from "@/lib/parse-status"

type Props = {
  runId: string
  accessToken: string
  onCancel?: () => void
}

const terminalStatuses = ["COMPLETED", "CANCELED", "FAILED", "CRASHED", "SYSTEM_FAILURE", "TIMED_OUT", "EXPIRED"]

// Resizable split hook
function useResizableSplit(defaultRatio = 0.5, minRatio = 0.2, maxRatio = 0.8) {
  const [ratio, setRatio] = useState(defaultRatio)
  const [isDragging, setIsDragging] = useState(false)

  const handleMouseDown = useCallback(() => {
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const container = document.getElementById("split-container")
      if (!container) return
      const rect = container.getBoundingClientRect()
      const newRatio = (e.clientY - rect.top) / rect.height
      setRatio(Math.min(maxRatio, Math.max(minRatio, newRatio)))
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    document.body.style.cursor = "row-resize"
    document.body.style.userSelect = "none"

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
  }, [isDragging, minRatio, maxRatio])

  return { ratio, isDragging, handleMouseDown }
}

export function RunViewer({ runId, accessToken }: Props) {
  const [localPrdOverride, setLocalPrdOverride] = useState<Prd | null>(null)
  const [latestProgress, setLatestProgress] = useState<string | null>(null)
  const { ratio, isDragging, handleMouseDown } = useResizableSplit(0.55)

  const { run, error: runError } = useRealtimeRun<typeof ralphLoop>(runId, {
    accessToken,
  })

  const isRunActive = run?.status && !terminalStatuses.includes(run.status)

  const { parts: rawStatusParts } = useRealtimeStream(statusStream, runId, {
    accessToken,
    timeoutInSeconds: 600, // Max allowed by API
  })

  // Parse status parts using utility
  const statusParts = parseStatusParts(rawStatusParts ?? [])

  // Track progress in state to ensure re-renders when it updates
  useEffect(() => {
    const progress = getLatestProgress(statusParts)
    if (progress && progress !== latestProgress) {
      setLatestProgress(progress)
    }
  }, [statusParts, latestProgress])

  // Derive state from status using utility functions
  const serverPrd = extractPrdFromStatus(statusParts)
  const currentPrd = localPrdOverride ?? serverPrd
  const completedStoryIds = extractCompletedStories(statusParts)
  const failedStoryIds = extractFailedStories(statusParts)
  const currentStoryId = getCurrentStoryId(statusParts)

  // Handle PRD changes from editor
  function handlePrdChange(prd: Prd) {
    setLocalPrdOverride(prd)
  }

  // Handle run error
  if (runError) {
    return (
      <div className="p-6">
        <p className="text-red-600">Error loading run: {runError.message}</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Terminal state banners */}
      {run?.status === "CANCELED" && (
        <div className="border border-yellow-400 bg-yellow-50 rounded-md p-4 text-center space-y-2 mx-4 mt-4">
          <p className="text-[24px]">🍩</p>
          <p className="text-[13px] font-medium text-yellow-800">Run canceled</p>
          <p className="text-[12px] text-yellow-700 italic">&ldquo;Me fail English? That&apos;s unpossible!&rdquo;</p>
        </div>
      )}
      {(run?.status === "FAILED" || run?.status === "CRASHED" || run?.status === "SYSTEM_FAILURE") && (() => {
        const errorStatus = statusParts.find(s => s.type === "error")
        const pushFailedStatus = statusParts.find(s => s.type === "push_failed")
        const lastStatus = statusParts[statusParts.length - 1]
        const errorMessage = errorStatus?.message ?? pushFailedStatus?.message
        const isNetworkError = errorMessage?.includes("Could not resolve host") ||
          errorMessage?.includes("timed out") ||
          errorMessage?.includes("Network error")

        return (
          <div className="border border-red-300 bg-red-50 rounded-md p-4 space-y-2 mx-4 mt-4">
            <p className="text-[13px] font-medium text-red-700">
              Run failed ({run.status})
            </p>
            {errorMessage && (
              <pre className="text-[11px] text-red-600 whitespace-pre-wrap font-mono bg-red-100 p-2 rounded">
                {errorMessage}
              </pre>
            )}
            {!errorMessage && lastStatus && lastStatus.type !== "error" && (
              <p className="text-[11px] text-red-600">
                Last action: {lastStatus.type} — {lastStatus.message?.slice(0, 100)}
              </p>
            )}
            <div className="pt-2 border-t border-red-200">
              <p className="text-[11px] text-red-700 font-medium">Next steps:</p>
              <ul className="text-[11px] text-red-600 list-disc ml-4 mt-1 space-y-0.5">
                {isNetworkError && <li>Check your internet connection and try again</li>}
                {errorMessage?.includes("GITHUB_TOKEN") && (
                  <li>Verify your GITHUB_TOKEN has the correct permissions</li>
                )}
                {errorMessage?.includes("not found") && (
                  <li>Double-check the repository URL is correct</li>
                )}
                {run.status === "CRASHED" && <li>Check Trigger.dev dashboard for detailed logs</li>}
                <li>Start a new task to try again</li>
              </ul>
            </div>
          </div>
        )
      })()}
      {run?.status === "TIMED_OUT" && (
        <div className="border border-orange-300 bg-orange-50 rounded-md p-4 space-y-2 mx-4 mt-4">
          <p className="text-[13px] font-medium text-orange-700">Run timed out</p>
          <p className="text-[11px] text-orange-600">
            The task exceeded its maximum duration.
          </p>
        </div>
      )}
      {run?.status === "EXPIRED" && (
        <div className="border border-slate-300 bg-slate-50 rounded-md p-4 space-y-2 mx-4 mt-4">
          <p className="text-[13px] font-medium text-slate-700">Run expired</p>
          <p className="text-[11px] text-slate-600">
            The waitpoint timed out while waiting for your response (24 hours).
          </p>
        </div>
      )}

      {/* Split view: PRD JSON + Progress */}
      <div
        id="split-container"
        className="flex-1 flex flex-col overflow-hidden"
      >
        {/* PRD JSON Editor */}
        <div
          style={{ height: `${ratio * 100}%` }}
          className="overflow-hidden"
        >
          <PrdJsonEditor
            prd={currentPrd}
            completedStoryIds={completedStoryIds}
            failedStoryIds={failedStoryIds}
            currentStoryId={currentStoryId}
            onPrdChange={handlePrdChange}
            readOnly={!isRunActive && !currentPrd}
          />
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleMouseDown}
          className={`
            h-2 flex-shrink-0 cursor-row-resize
            border-y border-slate-200 bg-slate-100
            hover:bg-slate-200 transition-colors
            flex items-center justify-center
            ${isDragging ? "bg-slate-300" : ""}
          `}
        >
          <div className="w-8 h-0.5 bg-slate-300 rounded-full" />
        </div>

        {/* Progress Log */}
        <div
          style={{ height: `${(1 - ratio) * 100}%` }}
          className="overflow-hidden"
        >
          <ProgressLog
            progress={latestProgress}
            isActive={isRunActive ?? false}
          />
        </div>
      </div>

    </div>
  )
}
