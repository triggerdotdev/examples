"use client"

import { useState } from "react"
import { useRealtimeRun, useRealtimeStream, useWaitToken } from "@trigger.dev/react-hooks"
import { statusStream, agentOutputStream, type StatusUpdate, type Prd } from "@/trigger/streams"
import type { ralphLoop } from "@/trigger/ralph-loop"
import { Button } from "@/components/ui/button"
import { cancelRun } from "@/app/actions"

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

type StoryResult = {
  commitHash?: string
  commitUrl?: string
}

function StoryList({
  prd,
  completedStories,
  currentStoryId,
}: {
  prd: Prd
  completedStories: Map<string, StoryResult>
  currentStoryId?: string
}) {
  return (
    <details open className="text-sm">
      <summary className="cursor-pointer font-medium text-gray-700">
        Stories ({completedStories.size}/{prd.stories.length} complete)
      </summary>
      <div className="mt-2 space-y-1">
        {prd.stories.map((story, i) => {
          const result = completedStories.get(story.id)
          const isComplete = !!result
          const isCurrent = story.id === currentStoryId
          return (
            <div
              key={story.id}
              className={`flex items-center gap-2 py-1 ${isComplete ? "opacity-50" : ""} ${isCurrent ? "bg-blue-50 -mx-2 px-2 rounded" : ""}`}
            >
              <span className="w-5 text-right text-gray-400">
                {isComplete ? "✓" : `${i + 1}.`}
              </span>
              <span className={isComplete ? "line-through" : ""}>{story.title}</span>
              {result?.commitUrl && (
                <a
                  href={result.commitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  commit
                </a>
              )}
              {isCurrent && <span className="text-xs text-blue-600 animate-pulse">in progress</span>}
            </div>
          )
        })}
      </div>
    </details>
  )
}

function PRDEditor({
  prd,
  tokenId,
  publicAccessToken,
}: {
  prd: Prd
  tokenId: string
  publicAccessToken: string
}) {
  const [prdJson, setPrdJson] = useState(() => JSON.stringify(prd, null, 2))
  const [parseError, setParseError] = useState<string>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string>()
  const { complete } = useWaitToken(tokenId, { accessToken: publicAccessToken })

  function handleChange(value: string) {
    setPrdJson(value)
    setParseError(undefined)
    try {
      JSON.parse(value)
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Invalid JSON")
    }
  }

  async function handleApprove() {
    setIsSubmitting(true)
    setSubmitError(undefined)
    try {
      const parsed = JSON.parse(prdJson) as Prd
      await complete({ action: "approve_prd", prd: parsed })
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to approve")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">Review and edit the generated PRD:</p>
      <textarea
        value={prdJson}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full h-80 p-3 font-mono text-xs bg-gray-900 text-gray-100 rounded-md border-0 focus:ring-2 focus:ring-blue-500"
        spellCheck={false}
      />
      {parseError && <p className="text-sm text-red-600">JSON error: {parseError}</p>}
      {submitError && <p className="text-sm text-red-600">{submitError}</p>}
      <Button onClick={handleApprove} disabled={isSubmitting || !!parseError} className="bg-green-600 hover:bg-green-700">
        {isSubmitting ? "Approving..." : "Approve & Start"}
      </Button>
    </div>
  )
}

const terminalStatuses = ["COMPLETED", "CANCELED", "FAILED", "CRASHED", "SYSTEM_FAILURE", "TIMED_OUT", "EXPIRED"]

export function RunViewer({ runId, accessToken }: Props) {
  const [isCanceling, setIsCanceling] = useState(false)
  const [cancelError, setCancelError] = useState<string>()

  const { run, error: runError } = useRealtimeRun<typeof ralphLoop>(runId, {
    accessToken,
  })

  const isRunActive = run?.status && !terminalStatuses.includes(run.status)

  async function handleCancel() {
    setIsCanceling(true)
    setCancelError(undefined)
    const result = await cancelRun(runId)
    if (!result.ok) {
      setCancelError(result.error)
    }
    setIsCanceling(false)
  }

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
  const pendingPrdReview = latestStatus?.type === "prd_review" ? { waitpoint: latestStatus.waitpoint, prd: latestStatus.prd } : null

  // Derive PRD from status events (prd_generated takes precedence over prd_review)
  const currentPrd = statusParts.reduce<Prd | null>((acc, s) => {
    if (s.type === "prd_generated" && s.prd) return s.prd
    if (s.type === "prd_review" && s.prd && !acc) return s.prd
    return acc
  }, null)

  // Derive completed stories from story_complete events
  const completedStories = new Map<string, StoryResult>()
  for (const s of statusParts) {
    if (s.type === "story_complete" && s.story?.id) {
      completedStories.set(s.story.id, {
        commitHash: s.commitHash,
        commitUrl: s.commitUrl,
      })
    }
  }

  // Derive current story from latest story_start (if not yet complete)
  const currentStoryId = statusParts.reduce<string | undefined>((acc, s) => {
    if (s.type === "story_start" && s.story?.id) return s.story.id
    if (s.type === "story_complete" && s.story?.id === acc) return undefined
    return acc
  }, undefined)

  // Debug logging
  console.log("[RunViewer] statusParts parsed:", statusParts)
  console.log("[RunViewer] latestStatus:", latestStatus)
  console.log("[RunViewer] pendingWaitpoint:", pendingWaitpoint)

  return (
    <div className="space-y-6">
      {/* Run status + token usage + cancel */}
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
          {isRunActive && (
            <Button variant="destructive" size="sm" onClick={handleCancel} disabled={isCanceling}>
              {isCanceling ? "Canceling..." : "Cancel Run"}
            </Button>
          )}
          {cancelError && <span className="text-xs text-red-600">{cancelError}</span>}
        </div>
        {latestStatus && (
          <div className="text-sm">
            {latestStatus.type === "iteration" && (
              <span className="text-blue-600">Iteration {latestStatus.iteration}</span>
            )}
            {latestStatus.type === "cloning" && (
              <span className="text-yellow-600">Cloning repo...</span>
            )}
            {latestStatus.type === "installing" && (
              <span className="text-yellow-600">Installing dependencies...</span>
            )}
            {latestStatus.type === "exploring" && (
              <span className="text-yellow-600">Exploring repo...</span>
            )}
            {latestStatus.type === "prd_review" && (
              <span className="text-yellow-600">Waiting for PRD review...</span>
            )}
            {latestStatus.type === "prd_generated" && (
              <span className="text-blue-600">PRD ready ({latestStatus.prd?.stories.length} stories)</span>
            )}
            {latestStatus.type === "story_start" && latestStatus.story && (
              <span className="text-blue-600">Story {latestStatus.story.current}/{latestStatus.story.total}: {latestStatus.story.title}</span>
            )}
            {latestStatus.type === "story_complete" && latestStatus.story && (
              <span className="text-green-600">✓ Story {latestStatus.story.current}/{latestStatus.story.total}</span>
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

        if (run?.status === "CANCELED") {
          return (
            <div className="border-2 border-gray-400 bg-gray-100 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700">Run canceled</p>
            </div>
          )
        }

        if (run?.status === "FAILED" || run?.status === "CRASHED" || run?.status === "SYSTEM_FAILURE") {
          return (
            <div className="border-2 border-red-400 bg-red-50 rounded-lg p-4">
              <p className="text-sm font-medium text-red-700">Run failed ({run.status})</p>
            </div>
          )
        }

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

        if (pendingPrdReview && pendingPrdReview.waitpoint && pendingPrdReview.prd) {
          return (
            <div className="border-2 border-blue-500 bg-blue-50 rounded-lg p-4">
              <PRDEditor
                prd={pendingPrdReview.prd}
                tokenId={pendingPrdReview.waitpoint.tokenId}
                publicAccessToken={pendingPrdReview.waitpoint.publicAccessToken}
              />
            </div>
          )
        }

        if (pendingWaitpoint) {
          return (
            <div className="border-2 border-yellow-500 bg-yellow-50 rounded-lg p-4 space-y-3">
              {latestStatus?.commitUrl && (
                <a
                  href={latestStatus.commitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  View commit →
                </a>
              )}
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

      {/* Story progress list */}
      {currentPrd && (
        <div className="border rounded-lg bg-gray-50 p-4">
          <StoryList
            prd={currentPrd}
            completedStories={completedStories}
            currentStoryId={currentStoryId}
          />
        </div>
      )}

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
