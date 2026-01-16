"use client"

import { useState } from "react"
import { useRealtimeRun, useRealtimeStream } from "@trigger.dev/react-hooks"
import { statusStream, type StatusUpdate, type Prd, type Story } from "@/trigger/streams"
import { KanbanBoard } from "./kanban-board"
import { StoryEditor } from "./story-editor"
import type { ralphLoop } from "@/trigger/ralph-loop"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type Props = {
  runId: string
  accessToken: string
  onCancel?: () => void
}

const terminalStatuses = ["COMPLETED", "CANCELED", "FAILED", "CRASHED", "SYSTEM_FAILURE", "TIMED_OUT", "EXPIRED"]

export function RunViewer({ runId, accessToken, onCancel }: Props) {
  const [editingStory, setEditingStory] = useState<Story | null>(null)
  const [localPrdOverride, setLocalPrdOverride] = useState<Prd | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [pendingDeleteStory, setPendingDeleteStory] = useState<Story | null>(null)

  const { run, error: runError } = useRealtimeRun<typeof ralphLoop>(runId, {
    accessToken,
  })

  const isRunActive = run?.status && !terminalStatuses.includes(run.status)

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

  function handleDeleteStory(story: Story) {
    if (!currentPrd) return
    const remainingStories = currentPrd.stories.filter(s => s.id !== story.id)
    // If deleting last story, show confirmation
    if (remainingStories.length === 0) {
      setPendingDeleteStory(story)
      setShowCancelConfirm(true)
      return
    }
    setLocalPrdOverride({ ...currentPrd, stories: remainingStories })
  }

  function confirmCancelRun() {
    if (!currentPrd || !pendingDeleteStory) return
    const remainingStories = currentPrd.stories.filter(s => s.id !== pendingDeleteStory.id)
    setLocalPrdOverride({ ...currentPrd, stories: remainingStories })
    setShowCancelConfirm(false)
    setPendingDeleteStory(null)
    onCancel?.()
  }

  // Derive completed/failed stories and per-story diffs from status events
  const completedStoryIds = new Set<string>()
  const failedStoryIds = new Set<string>()
  const storyDiffs = new Map<string, string>()
  const storyErrors = new Map<string, string>()
  for (const s of statusParts) {
    if (s.type === "story_complete" && s.story?.id) {
      completedStoryIds.add(s.story.id)
      if (s.story.diff) {
        storyDiffs.set(s.story.id, s.story.diff)
      }
    }
    if (s.type === "story_failed" && s.story?.id) {
      failedStoryIds.add(s.story.id)
      if (s.story.diff) {
        storyDiffs.set(s.story.id, s.story.diff)
      }
      if (s.storyError) {
        storyErrors.set(s.story.id, s.storyError)
      }
    }
  }

  // Derive current story from latest story_start (if not yet complete/failed)
  const currentStoryId = statusParts.reduce<string | undefined>((acc, s) => {
    if (s.type === "story_start" && s.story?.id) return s.story.id
    if (s.type === "story_complete" && s.story?.id === acc) return undefined
    if (s.type === "story_failed" && s.story?.id === acc) return undefined
    return acc
  }, undefined)

  // Handle run error
  if (runError) {
    return (
      <div className="p-6">
        <p className="text-red-600">Error loading run: {runError.message}</p>
      </div>
    )
  }

  // Derive pushed status for branch/PR link
  const pushedStatus = statusParts.find(s => s.type === "pushed")

  return (
    <div className="space-y-6">
      {/* Terminal state banners */}
      {run?.status === "CANCELED" && (
        <div className="border border-yellow-400 bg-yellow-50 rounded-md p-4 text-center space-y-2">
          <p className="text-[24px]">🍩</p>
          <p className="text-[13px] font-medium text-yellow-800">Run canceled</p>
          <p className="text-[12px] text-yellow-700 italic">&ldquo;Me fail English? That&apos;s unpossible!&rdquo;</p>
        </div>
      )}
      {(run?.status === "FAILED" || run?.status === "CRASHED" || run?.status === "SYSTEM_FAILURE") && (() => {
        // Find error status and last action for context
        const errorStatus = statusParts.find(s => s.type === "error")
        const pushFailedStatus = statusParts.find(s => s.type === "push_failed")
        const lastStatus = statusParts[statusParts.length - 1]
        const errorMessage = errorStatus?.message ?? pushFailedStatus?.message

        // Determine if this is a network-related error
        const isNetworkError = errorMessage?.includes("Could not resolve host") ||
          errorMessage?.includes("timed out") ||
          errorMessage?.includes("Network error")

        return (
          <div className="border border-red-300 bg-red-50 rounded-md p-4 space-y-2">
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
        <div className="border border-orange-300 bg-orange-50 rounded-md p-4 space-y-2">
          <p className="text-[13px] font-medium text-orange-700">
            Run timed out
          </p>
          <p className="text-[11px] text-orange-600">
            The task exceeded its maximum duration. This might happen with very large repositories or complex prompts.
          </p>
          <div className="pt-2 border-t border-orange-200">
            <p className="text-[11px] text-orange-700 font-medium">Next steps:</p>
            <ul className="text-[11px] text-orange-600 list-disc ml-4 mt-1 space-y-0.5">
              <li>Try breaking the task into smaller pieces</li>
              <li>Use fewer stories with more focused acceptance criteria</li>
              <li>Start a new task to try again</li>
            </ul>
          </div>
        </div>
      )}
      {run?.status === "EXPIRED" && (
        <div className="border border-slate-300 bg-slate-50 rounded-md p-4 space-y-2">
          <p className="text-[13px] font-medium text-slate-700">
            Run expired
          </p>
          <p className="text-[11px] text-slate-600">
            The waitpoint timed out while waiting for your response (24 hours).
          </p>
          <div className="pt-2 border-t border-slate-200">
            <p className="text-[11px] text-slate-700 font-medium">Next steps:</p>
            <ul className="text-[11px] text-slate-600 list-disc ml-4 mt-1 space-y-0.5">
              <li>Start a new task and respond to approval prompts within 24 hours</li>
            </ul>
          </div>
        </div>
      )}

      {/* Kanban board or placeholder */}
      {currentPrd ? (
        <div className="border rounded-md bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-semibold text-foreground">
              Stories ({completedStoryIds.size}/{currentPrd.stories.length} complete)
            </h2>
          </div>
          <KanbanBoard
            prd={currentPrd}
            completedStoryIds={completedStoryIds}
            failedStoryIds={failedStoryIds}
            currentStoryId={currentStoryId}
            storyDiffs={storyDiffs}
            storyErrors={storyErrors}
            onEditStory={handleEditStory}
          />
        </div>
      ) : isRunActive ? (
        <div className="border rounded-md bg-card p-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <span className="inline-block text-[24px] animate-blink">🍩</span>
              <p className="text-[13px] text-slate-500">Generating stories...</p>
            </div>
          </div>
        </div>
      ) : null}

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

      {/* Modals */}
      {editingStory && (
        <StoryEditor
          story={editingStory}
          onSave={handleSaveStory}
          onCancel={() => setEditingStory(null)}
        />
      )}

      {/* Cancel confirmation dialog */}
      <AlertDialog open={showCancelConfirm} onOpenChange={(open) => {
        if (!open) {
          setShowCancelConfirm(false)
          setPendingDeleteStory(null)
        }
      }}>
        <AlertDialogContent className="max-w-sm text-center">
          <AlertDialogHeader>
            <p className="text-[32px] mb-2">🍩</p>
            <AlertDialogTitle className="text-[14px]">Delete last story?</AlertDialogTitle>
            <AlertDialogDescription className="text-[12px]">
              &ldquo;I bent my wookie!&rdquo; — This will cancel the run.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="justify-center sm:justify-center">
            <AlertDialogCancel className="text-[12px]">Keep going</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancelRun}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-[12px]"
            >
              Cancel run
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
