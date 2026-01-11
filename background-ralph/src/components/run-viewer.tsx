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

  async function handleAction(action: "continue" | "stop") {
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
      <div className="flex gap-2">
        <Button onClick={() => handleAction("continue")} disabled={isSubmitting}>
          {isSubmitting ? "..." : "Continue"}
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

      {/* Approval gate UI - always visible */}
      <div className={`border-2 rounded-lg p-4 ${pendingWaitpoint ? "border-yellow-500 bg-yellow-50" : "border-gray-200 bg-gray-50"}`}>
        {pendingWaitpoint ? (
          <ApprovalGate
            tokenId={pendingWaitpoint.tokenId}
            publicAccessToken={pendingWaitpoint.publicAccessToken}
            question={pendingWaitpoint.question}
          />
        ) : (
          <p className="text-sm text-gray-500">Agent running... approval buttons will appear when paused.</p>
        )}
      </div>

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
