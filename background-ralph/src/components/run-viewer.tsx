"use client"

import { useState } from "react"
import { useRealtimeRun, useRealtimeStream, useWaitToken } from "@trigger.dev/react-hooks"
import { statusStream, type StatusUpdate, type Prd, type Story } from "@/trigger/streams"
import { KanbanBoard } from "./kanban-board"
import { StoryEditor } from "./story-editor"
import { HelpModal } from "./help-modal"
import { ShortcutFooter } from "./shortcut-footer"
import { useKeyboardShortcuts } from "./keyboard-handler"
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


function PrdApprovalButton({
  tokenId,
  publicAccessToken,
  prd,
}: {
  tokenId: string
  publicAccessToken: string
  prd: Prd
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string>()
  const { complete } = useWaitToken(tokenId, { accessToken: publicAccessToken })

  async function handleApprove() {
    setIsSubmitting(true)
    setError(undefined)
    try {
      await complete({ action: "approve_prd", prd })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">
        Review stories below, then approve to start
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button
        onClick={handleApprove}
        disabled={isSubmitting}
        className="bg-green-600 hover:bg-green-700"
      >
        {isSubmitting ? "Starting..." : "Approve & Start"}
      </Button>
    </div>
  )
}

const terminalStatuses = ["COMPLETED", "CANCELED", "FAILED", "CRASHED", "SYSTEM_FAILURE", "TIMED_OUT", "EXPIRED"]

export function RunViewer({ runId, accessToken }: Props) {
  const [isCanceling, setIsCanceling] = useState(false)
  const [cancelError, setCancelError] = useState<string>()
  const [editingStory, setEditingStory] = useState<Story | null>(null)
  const [localPrdOverride, setLocalPrdOverride] = useState<Prd | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0)

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

  // Check if we're waiting for approval
  const pendingWaitpoint = latestStatus?.type === "waitpoint" ? latestStatus.waitpoint : null
  const pendingPrdReview = latestStatus?.type === "prd_review" ? { waitpoint: latestStatus.waitpoint, prd: latestStatus.prd } : null


  // Derive PRD from status events (prd_generated takes precedence over prd_review)
  // Use local override if user has edited stories
  const serverPrd = statusParts.reduce<Prd | null>((acc, s) => {
    if (s.type === "prd_generated" && s.prd) return s.prd
    if (s.type === "prd_review" && s.prd && !acc) return s.prd
    return acc
  }, null)
  const currentPrd = localPrdOverride ?? serverPrd

  // Handle story editing
  function handleEditStory(story: Story) {
    setEditingStory(story)
  }

  function handleSaveStory(updated: Story) {
    if (!currentPrd) return
    const updatedStories = currentPrd.stories.map(s =>
      s.id === updated.id ? updated : s
    )
    setLocalPrdOverride({ ...currentPrd, stories: updatedStories })
    setEditingStory(null)
  }

  // Derive completed stories and per-story diffs from story_complete events
  const completedStoryIds = new Set<string>()
  const storyDiffs = new Map<string, string>()
  for (const s of statusParts) {
    if (s.type === "story_complete" && s.story?.id) {
      completedStoryIds.add(s.story.id)
      if (s.story.diff) {
        storyDiffs.set(s.story.id, s.story.diff)
      }
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

  // Get pending stories for keyboard navigation
  const pendingStories = currentPrd?.stories.filter(s =>
    !completedStoryIds.has(s.id) && s.id !== currentStoryId
  ) ?? []

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onHelp: () => setShowHelp(true),
    onEdit: () => {
      const story = pendingStories[selectedStoryIndex]
      if (story) setEditingStory(story)
    },
    onNavigateUp: () => {
      setSelectedStoryIndex(Math.max(0, selectedStoryIndex - 1))
    },
    onNavigateDown: () => {
      setSelectedStoryIndex(Math.min(pendingStories.length - 1, selectedStoryIndex + 1))
    },
    disabled: !!editingStory || showHelp,
  })

  // Handle run error
  if (runError) {
    return (
      <div className="p-6">
        <p className="text-red-600">Error loading run: {runError.message}</p>
        <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
      </div>
    )
  }

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
          const storyCount = currentPrd?.stories.length ?? 0
          const doneCount = completedStoryIds.size
          return (
            <div className="border-2 border-green-500 bg-green-50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-green-800">
                {doneCount}/{storyCount} stories complete
              </p>
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
              <PrdApprovalButton
                tokenId={pendingPrdReview.waitpoint.tokenId}
                publicAccessToken={pendingPrdReview.waitpoint.publicAccessToken}
                prd={currentPrd ?? pendingPrdReview.prd}
              />
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

      {/* Kanban board */}
      {currentPrd && (
        <div className="border rounded-lg bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">
              Stories ({completedStoryIds.size}/{currentPrd.stories.length} complete)
            </h2>
          </div>
          <KanbanBoard
            prd={currentPrd}
            completedStoryIds={completedStoryIds}
            currentStoryId={currentStoryId}
            storyDiffs={storyDiffs}
            onEditStory={handleEditStory}
          />
        </div>
      )}

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

      {/* Footer with shortcuts */}
      {currentPrd && (
        <ShortcutFooter
          completedCount={completedStoryIds.size}
          totalCount={currentPrd.stories.length}
          onHelp={() => setShowHelp(true)}
        />
      )}

      {/* Modals */}
      {editingStory && (
        <StoryEditor
          story={editingStory}
          onSave={handleSaveStory}
          onCancel={() => setEditingStory(null)}
        />
      )}

      <HelpModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
      />
    </div>
  )
}
