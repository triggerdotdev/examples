import type { Prd, Story } from "@/trigger/streams"
import { StoryCard } from "./story-card"

type Props = {
  prd: Prd
  completedStoryIds: Set<string>
  failedStoryIds?: Set<string>
  currentStoryId?: string
  storyDiffs?: Map<string, string>
  storyErrors?: Map<string, string>
  onEditStory?: (story: Story) => void
  onRetryStory?: (story: Story) => void
}

function KanbanColumn({
  title,
  stories,
  status,
  emptyText,
  diffs,
  errors,
  onEdit,
  onRetry,
}: {
  title: string
  stories: Story[]
  status: "pending" | "in_progress" | "done" | "failed"
  emptyText: string
  diffs?: Map<string, string>
  errors?: Map<string, string>
  onEdit?: (story: Story) => void
  onRetry?: (story: Story) => void
}) {
  const headerStyle = {
    pending: "text-slate-500",
    in_progress: "text-blue-600",
    done: "text-emerald-600",
    failed: "text-red-600",
  }[status]

  const countStyle = {
    pending: "bg-slate-100 text-slate-500",
    in_progress: "bg-blue-100 text-blue-600",
    done: "bg-emerald-100 text-emerald-600",
    failed: "bg-red-100 text-red-600",
  }[status]

  return (
    <div className="flex-1 min-w-[260px]">
      {/* Column header */}
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200">
        <h3 className={`text-xs font-semibold uppercase tracking-wider ${headerStyle}`}>
          {title}
        </h3>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${countStyle}`}>
          {stories.length}
        </span>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {stories.length === 0 ? (
          <p className="text-[11px] text-slate-400 py-8 text-center">{emptyText}</p>
        ) : (
          stories.map((story) => (
            <StoryCard
              key={story.id}
              story={story}
              status={status}
              diff={diffs?.get(story.id)}
              error={errors?.get(story.id)}
              onEdit={status === "pending" ? onEdit : undefined}
              onRetry={status === "failed" ? onRetry : undefined}
            />
          ))
        )}
      </div>
    </div>
  )
}

export function KanbanBoard({
  prd,
  completedStoryIds,
  failedStoryIds = new Set(),
  currentStoryId,
  storyDiffs,
  storyErrors,
  onEditStory,
  onRetryStory,
}: Props) {
  const pendingStories: Story[] = []
  const inProgressStories: Story[] = []
  const doneStories: Story[] = []
  const failedStories: Story[] = []

  for (const story of prd.stories) {
    if (completedStoryIds.has(story.id)) {
      doneStories.push(story)
    } else if (failedStoryIds.has(story.id)) {
      failedStories.push(story)
    } else if (story.id === currentStoryId) {
      inProgressStories.push(story)
    } else {
      pendingStories.push(story)
    }
  }

  return (
    <div className="flex gap-8 overflow-x-auto pb-2">
      <KanbanColumn
        title="Pending"
        stories={pendingStories}
        status="pending"
        emptyText="No pending stories"
        onEdit={onEditStory}
      />
      <KanbanColumn
        title="In progress"
        stories={inProgressStories}
        status="in_progress"
        emptyText="No active story"
      />
      {failedStories.length > 0 && (
        <KanbanColumn
          title="Failed"
          stories={failedStories}
          status="failed"
          emptyText="No failed stories"
          diffs={storyDiffs}
          errors={storyErrors}
          onRetry={onRetryStory}
        />
      )}
      <KanbanColumn
        title="Done"
        stories={doneStories}
        status="done"
        emptyText="No completed stories"
        diffs={storyDiffs}
      />
    </div>
  )
}
