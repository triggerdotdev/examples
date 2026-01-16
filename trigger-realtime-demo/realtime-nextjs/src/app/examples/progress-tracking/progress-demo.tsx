"use client"

// =============================================================================
// PROGRESS DEMO COMPONENT
// =============================================================================
// This component demonstrates how to:
// 1. Trigger a Trigger.dev task from a React component
// 2. Subscribe to real-time progress updates using useRealtimeStream
// 3. Display a progress bar and step indicator
//
// The flow is:
// User clicks "Start Task" → Server Action triggers task → Task streams updates
// → useRealtimeStream receives updates → UI updates in real-time
// =============================================================================

import { useState } from "react"
import { useRealtimeStream } from "@trigger.dev/react-hooks"
import { Button } from "@/components/ui/button"
import { CodeLink } from "@/components/code-link"
import { progressMappings } from "@/lib/code-mappings"
import { progressStream, Step } from "@/trigger/streams"
import { startProcessing } from "./actions"
import { Check, Circle, Loader2 } from "lucide-react"

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * ProgressDemo is the main component that users interact with.
 * It manages the "run state" (runId + token) which is needed to
 * subscribe to real-time updates from the task.
 */
export function ProgressDemo() {
  // ---------------------------------------------------------------------------
  // STATE MANAGEMENT
  // ---------------------------------------------------------------------------
  // We track two pieces of state:
  // 1. runState: Contains the runId and token after triggering a task
  // 2. isStarting: Loading state while the task is being triggered
  // ---------------------------------------------------------------------------
  const [runState, setRunState] = useState<{
    runId: string
    token: string
  } | null>(null)
  const [isStarting, setIsStarting] = useState(false)

  // ---------------------------------------------------------------------------
  // EVENT HANDLERS
  // ---------------------------------------------------------------------------

  /**
   * Handles the "Start Task" button click.
   * Calls the server action to trigger the task and stores the result.
   */
  const handleStart = async () => {
    setIsStarting(true)

    // Call the server action to trigger the task
    // This returns the runId (to subscribe to) and token (for authentication)
    const result = await startProcessing(5) // Process 5 items

    // Store the result so ProgressDisplay can subscribe to updates
    setRunState({ runId: result.runId, token: result.token })
    setIsStarting(false)
  }

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Start Button Section */}
      <div className="flex items-center gap-4">
        {/* Wrap in CodeLink to highlight the server action code when clicked */}
        <CodeLink mapping={progressMappings["trigger-button"]}>
          <Button
            data-code-id="trigger-button"
            onClick={handleStart}
            disabled={isStarting || !!runState}
          >
            {isStarting ? "Starting..." : runState ? "Running..." : "Start Task"}
          </Button>
        </CodeLink>
        <span className="text-sm text-muted-foreground">
          {runState ? "Processing items..." : "Click to start processing"}
        </span>
      </div>

      {/* Progress Display Section */}
      {/* Show ProgressDisplay when we have a runState, otherwise show placeholder */}
      {runState ? (
        <ProgressDisplay runId={runState.runId} token={runState.token} />
      ) : (
        <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
          <p className="text-sm text-muted-foreground">
            Progress updates will appear here when you start the task
          </p>
          {/* Links to highlight relevant code sections */}
          <div className="text-xs text-muted-foreground space-x-4">
            <CodeLink mapping={progressMappings["progress-stream"]}>
              <span
                className="underline decoration-dotted underline-offset-4"
                data-code-id="progress-stream"
              >
                View stream definition
              </span>
            </CodeLink>
            <CodeLink mapping={progressMappings["stream-write"]}>
              <span
                className="underline decoration-dotted underline-offset-4"
                data-code-id="stream-write"
              >
                View stream.append()
              </span>
            </CodeLink>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// PROGRESS DISPLAY COMPONENT
// =============================================================================

/**
 * ProgressDisplay subscribes to real-time updates from the task.
 * It uses useRealtimeStream to receive ProgressUpdate objects as they're
 * streamed from the task.
 *
 * @param runId - The ID of the task run to subscribe to
 * @param token - The public access token for authentication
 */
function ProgressDisplay({ runId, token }: { runId: string; token: string }) {
  // ---------------------------------------------------------------------------
  // SUBSCRIBE TO REAL-TIME UPDATES
  // ---------------------------------------------------------------------------
  // useRealtimeStream connects to Trigger.dev's real-time API and receives
  // updates as they're streamed from the task. The `parts` array contains
  // all the ProgressUpdate objects received so far.
  // ---------------------------------------------------------------------------
  const { parts, error } = useRealtimeStream(progressStream, runId, {
    accessToken: token,
    timeoutInSeconds: 300, // How long to wait for updates before timing out
  })

  // ---------------------------------------------------------------------------
  // ERROR HANDLING
  // ---------------------------------------------------------------------------
  if (error) {
    return (
      <div className="rounded-lg border border-red-500/50 p-4 bg-red-500/10">
        <p className="text-sm text-red-500">Error: {error.message}</p>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // EXTRACT LATEST UPDATE
  // ---------------------------------------------------------------------------
  // The `parts` array contains all updates received so far.
  // We want the most recent one for displaying current progress.
  const latestUpdate = parts?.[parts.length - 1]

  // Calculate percentage from current/total
  const percentage = latestUpdate
    ? Math.round((latestUpdate.current / latestUpdate.total) * 100)
    : 0

  // Check if task is complete (all steps are completed)
  const isComplete = latestUpdate?.steps?.every((s) => s.status === "completed")

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <div className="rounded-lg border p-4 bg-muted/30 space-y-4">
      {/* Progress Bar Section */}
      <CodeLink mapping={progressMappings["stream-write"]}>
        <div className="space-y-2" data-code-id="progress-display">
          {/* The actual progress bar */}
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>

          {/* Status message and percentage */}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {latestUpdate?.message || "Starting..."}
            </span>
            <span className="font-mono text-muted-foreground">
              {percentage}%
            </span>
          </div>
        </div>
      </CodeLink>

      {/* Success message when complete */}
      {isComplete && (
        <p className="text-sm text-green-600 font-medium">
          Processing complete!
        </p>
      )}

      {/* Step Indicator Section - Shows at the bottom */}
      {latestUpdate?.steps && (
        <StepIndicator steps={latestUpdate.steps} />
      )}

      {/* Links to highlight relevant code sections */}
      <div className="text-xs text-muted-foreground space-x-4 pt-2 border-t border-border">
        <CodeLink mapping={progressMappings["progress-stream"]}>
          <span
            className="underline decoration-dotted underline-offset-4"
            data-code-id="progress-stream"
          >
            View stream definition
          </span>
        </CodeLink>
        <CodeLink mapping={progressMappings["stream-write"]}>
          <span
            className="underline decoration-dotted underline-offset-4"
            data-code-id="stream-write"
          >
            View stream.append()
          </span>
        </CodeLink>
      </div>
    </div>
  )
}

// =============================================================================
// STEP INDICATOR COMPONENT
// =============================================================================

/**
 * StepIndicator displays a horizontal list of steps with their status.
 * Each step shows:
 * - A circle icon (pending), spinner (active), or checkmark (completed)
 * - The step label
 * - The step description (for the active step)
 *
 * @param steps - Array of Step objects from the progress update
 */
function StepIndicator({ steps }: { steps: Step[] }) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Steps
      </p>

      {/* Step List */}
      <div className="flex items-start gap-2">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-start gap-2 flex-1">
            {/* Step Content */}
            <div className="flex flex-col items-center gap-1 flex-1">
              {/* Step Icon */}
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center
                  transition-colors duration-200
                  ${step.status === "completed"
                    ? "bg-green-500/20 text-green-600"
                    : step.status === "active"
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                  }
                `}
              >
                {step.status === "completed" ? (
                  <Check className="w-4 h-4" />
                ) : step.status === "active" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Circle className="w-4 h-4" />
                )}
              </div>

              {/* Step Label */}
              <span
                className={`
                  text-xs font-medium text-center
                  ${step.status === "active"
                    ? "text-foreground"
                    : "text-muted-foreground"
                  }
                `}
              >
                {step.label}
              </span>

              {/* Step Description (only for active step) */}
              {step.status === "active" && (
                <span className="text-xs text-muted-foreground text-center">
                  {step.description}
                </span>
              )}
            </div>

            {/* Connector Line (except for last step) */}
            {index < steps.length - 1 && (
              <div
                className={`
                  h-0.5 flex-1 mt-4 rounded-full
                  ${step.status === "completed"
                    ? "bg-green-500/50"
                    : "bg-muted"
                  }
                `}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
