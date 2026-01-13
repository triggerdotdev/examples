"use client"

import { useState } from "react"
import { useRealtimeRun, useRealtimeStream } from "@trigger.dev/react-hooks"
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

  // Derive pushed status for branch/PR link
  const pushedStatus = statusParts.find(s => s.type === "pushed")

  return (
    <div className="space-y-6">
      {/* Terminal state banners */}
      {run?.status === "CANCELED" && (
        <div className="border border-slate-300 bg-slate-50 rounded-md p-3">
          <p className="text-[12px] font-medium text-slate-600">Run canceled</p>
        </div>
      )}
      {(run?.status === "FAILED" || run?.status === "CRASHED" || run?.status === "SYSTEM_FAILURE") && (
        <div className="border border-red-300 bg-red-50 rounded-md p-3">
          <p className="text-[12px] font-medium text-red-700">Run failed ({run.status})</p>
        </div>
      )}
      {run?.status === "COMPLETED" && (() => {
        const diffStatus = statusParts.find(s => s.type === "diff")
        const storyCount = currentPrd?.stories.length ?? 0
        const doneCount = completedStoryIds.size
        return (
          <div className="border border-green-400 bg-green-50 rounded-md p-4 space-y-3">
            <p className="text-[13px] font-medium text-green-800">
              {doneCount}/{storyCount} stories complete
            </p>
            {pushedStatus?.prUrl && (
              <a href={pushedStatus.prUrl} target="_blank" rel="noopener noreferrer" className="inline-block px-3 py-1.5 bg-green-600 text-white rounded text-[12px] font-medium hover:bg-green-700">
                View Pull Request →
              </a>
            )}
            {pushedStatus?.branchUrl && !pushedStatus.prUrl && (
              <a href={pushedStatus.branchUrl} target="_blank" rel="noopener noreferrer" className="inline-block px-3 py-1.5 bg-blue-600 text-white rounded text-[12px] font-medium hover:bg-blue-700">
                View Branch →
              </a>
            )}
            {diffStatus?.diff && (
              <details className="text-[12px]">
                <summary className="cursor-pointer text-green-700 font-medium">View diff</summary>
                <pre className="mt-2 p-3 bg-slate-900 text-slate-100 rounded overflow-auto max-h-[300px] text-[10px] font-mono">{diffStatus.diff}</pre>
              </details>
            )}
          </div>
        )
      })()}

      {/* Minimal status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isRunActive && (
            <>
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[12px] text-muted-foreground">Running</span>
            </>
          )}
          {!isRunActive && run?.status === "COMPLETED" && (
            <span className="text-[12px] text-green-600 font-medium">Complete</span>
          )}
          {pushedStatus?.prUrl && (
            <a href={pushedStatus.prUrl} target="_blank" rel="noopener noreferrer" className="text-[12px] text-blue-500 hover:underline">
              View PR →
            </a>
          )}
          {pushedStatus?.branchUrl && !pushedStatus.prUrl && (
            <a href={pushedStatus.branchUrl} target="_blank" rel="noopener noreferrer" className="text-[12px] text-blue-500 hover:underline">
              View branch →
            </a>
          )}
          {cancelError && <span className="text-[11px] text-red-500">{cancelError}</span>}
        </div>
        {isRunActive && (
          <Button variant="outline" size="sm" onClick={handleCancel} disabled={isCanceling} className="h-7 text-[11px]">
            {isCanceling ? "..." : "Cancel"}
          </Button>
        )}
      </div>

      {/* Kanban board */}
      {currentPrd && (
        <div className="border rounded-md bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-semibold text-foreground">
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
