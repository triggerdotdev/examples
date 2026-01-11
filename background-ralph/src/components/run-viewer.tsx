"use client"

import { useState } from "react"
import { useRealtimeRun, useRealtimeStream, useWaitToken } from "@trigger.dev/react-hooks"
import { statusStream, agentOutputStream, type StatusUpdate } from "@/trigger/streams"
import type { ralphLoop } from "@/trigger/ralph-loop"
import { Button } from "@/components/ui/button"

type Props = {
  runId: string
  accessToken: string
}

function ApprovalGate({
  tokenId,
  publicAccessToken,
  question,
}: {
  tokenId: string
  publicAccessToken: string
  question: string
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string>()
  const { complete } = useWaitToken(tokenId, { accessToken: publicAccessToken })

  console.log("[ApprovalGate] Rendering", { tokenId, publicAccessToken: publicAccessToken?.slice(0, 20) })

  async function handleAction(action: "continue" | "stop" | "approve_complete") {
    console.log("[ApprovalGate] handleAction", action)
    setIsSubmitting(true)
    setError(undefined)
    try {
      await complete({ action })
      console.log("[ApprovalGate] complete succeeded")
    } catch (e) {
      console.error("[ApprovalGate] Failed to complete token", e)
      setError(e instanceof Error ? e.message : "Failed to complete")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700 font-medium">⏸ {question}</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2 flex-wrap">
        <Button onClick={() => handleAction("continue")} disabled={isSubmitting}>
          {isSubmitting ? "..." : "Continue"}
        </Button>
        <Button onClick={() => handleAction("approve_complete")} disabled={isSubmitting} variant="default" className="bg-green-600 hover:bg-green-700">
          {isSubmitting ? "..." : "Approve & Complete"}
        </Button>
        <Button onClick={() => handleAction("stop")} disabled={isSubmitting} variant="outline">
          {isSubmitting ? "..." : "Stop"}
        </Button>
      </div>
    </div>
  )
}

export function RunViewer({ runId, accessToken }: Props) {
  const { run, error: runError } = useRealtimeRun<typeof ralphLoop>(runId, {
    accessToken,
  })

  const { parts: rawStatusParts } = useRealtimeStream(statusStream, runId, {
    accessToken,
  })

  const { parts: outputParts } = useRealtimeStream(agentOutputStream, runId, {
    accessToken,
  })

  if (runError) {
    return <div className="text-red-600">Error: {runError.message}</div>
  }

  // Parse JSON strings back to objects
  const statusParts: StatusUpdate[] = (rawStatusParts ?? []).map(part => {
    try {
      return JSON.parse(part) as StatusUpdate
    } catch {
      console.warn("[RunViewer] Failed to parse status part:", part)
      return { type: "error", message: `Parse error: ${part}` } as StatusUpdate
    }
  })

  const latestStatus = statusParts[statusParts.length - 1]
  const agentOutput = outputParts?.join("") ?? ""

  // Check if we're waiting for approval
  const pendingWaitpoint = latestStatus?.type === "waitpoint" ? latestStatus.waitpoint : null

  // Debug logging
  console.log("[RunViewer] statusParts parsed:", statusParts)
  console.log("[RunViewer] latestStatus:", latestStatus)
  console.log("[RunViewer] pendingWaitpoint:", pendingWaitpoint)

  return (
    <div className="space-y-6">
      {/* Run status + token usage */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            Status: <span className="font-medium text-gray-900">{run?.status ?? "loading..."}</span>
          </div>
          {latestStatus?.usage && (
            <div className="text-xs text-gray-400 font-mono">
              {latestStatus.usage.inputTokens.toLocaleString()}↓ {latestStatus.usage.outputTokens.toLocaleString()}↑
              {(latestStatus.usage.cacheReadTokens > 0) && ` (${latestStatus.usage.cacheReadTokens.toLocaleString()} cached)`}
            </div>
          )}
        </div>
        {latestStatus && (
          <div className="text-sm">
            {latestStatus.type === "iteration" && (
              <span className="text-blue-600">Iteration {latestStatus.iteration}</span>
            )}
            {latestStatus.type === "cloning" && (
              <span className="text-yellow-600">Cloning repo...</span>
            )}
            {latestStatus.type === "working" && (
              <span className="text-blue-600">Agent working...</span>
            )}
            {latestStatus.type === "waitpoint" && (
              <span className="text-yellow-600">Waiting for approval...</span>
            )}
            {latestStatus.type === "complete" && (
              <span className="text-green-600">Complete</span>
            )}
            {latestStatus.type === "agent_complete" && (
              <span className="text-green-600">Claude completed the task</span>
            )}
            {latestStatus.type === "user_approved" && (
              <span className="text-green-600">Approved by user</span>
            )}
            {latestStatus.type === "tests_passed" && (
              <span className="text-green-600">Tests passed</span>
            )}
            {latestStatus.type === "tests_failed" && (
              <span className="text-yellow-600">Tests failed, continuing...</span>
            )}
            {latestStatus.type === "error" && (
              <span className="text-red-600">{latestStatus.message}</span>
            )}
            {latestStatus.type === "pushed" && (latestStatus.prUrl || latestStatus.branchUrl) && (
              <a
                href={latestStatus.prUrl ?? latestStatus.branchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                {latestStatus.prUrl ? "View PR" : "View branch"}
              </a>
            )}
          </div>
        )}
      </div>

      {/* Approval gate UI or completion summary */}
      {(() => {
        const isComplete = latestStatus?.type === "complete" || latestStatus?.type === "agent_complete" || latestStatus?.type === "user_approved" || latestStatus?.type === "pushed" || latestStatus?.type === "tests_passed"
        const diffStatus = statusParts.find(s => s.type === "diff")
        const pushedStatus = statusParts.find(s => s.type === "pushed")

        if (isComplete || run?.status === "COMPLETED") {
          return (
            <div className="border-2 border-green-500 bg-green-50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-green-800">✓ Task completed</p>
              {pushedStatus?.prUrl && (
                <a href={pushedStatus.prUrl} target="_blank" rel="noopener noreferrer" className="inline-block px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium">
                  View Pull Request →
                </a>
              )}
              {pushedStatus?.branchUrl && !pushedStatus.prUrl && (
                <a href={pushedStatus.branchUrl} target="_blank" rel="noopener noreferrer" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium">
                  View Branch →
                </a>
              )}
              {diffStatus?.diff && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-green-700 font-medium">View diff</summary>
                  <pre className="mt-2 p-3 bg-gray-900 text-gray-100 rounded-md overflow-auto max-h-[300px] text-xs font-mono">{diffStatus.diff}</pre>
                </details>
              )}
            </div>
          )
        }

        if (pendingWaitpoint) {
          return (
            <div className="border-2 border-yellow-500 bg-yellow-50 rounded-lg p-4">
              <ApprovalGate
                tokenId={pendingWaitpoint.tokenId}
                publicAccessToken={pendingWaitpoint.publicAccessToken}
                question={pendingWaitpoint.question}
              />
            </div>
          )
        }

        return (
          <div className="border-2 border-gray-200 bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Agent running... approval buttons will appear when paused.</p>
          </div>
        )
      })()}

      {/* Agent output */}
      <div className="border rounded-lg bg-gray-950 p-4 min-h-[300px] max-h-[600px] overflow-auto">
        <pre className="text-sm text-gray-100 whitespace-pre-wrap font-mono">
          {agentOutput || "Waiting for agent output..."}
        </pre>
      </div>

      {/* Status history */}
      {statusParts.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-500">Status history ({statusParts.length})</summary>
          <ul className="mt-2 space-y-1 text-gray-600">
            {statusParts.map((s, i) => (
              <li key={i}>
                <span className="font-mono text-xs">[{s.type}]</span> {s.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
