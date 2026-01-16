"use client"

import { useState } from "react"
import { useRealtimeStream } from "@trigger.dev/react-hooks"
import { Button } from "@/components/ui/button"
import { CodeLink } from "@/components/code-link"
import { progressMappings } from "@/lib/code-mappings"
import { progressStream, Step } from "@/trigger/streams"
import { startProcessing } from "./actions"
import { Check, Circle, Loader2 } from "lucide-react"

export function ProgressDemo() {
  const [runState, setRunState] = useState<{ runId: string; token: string } | null>(null)
  const [isStarting, setIsStarting] = useState(false)

  const handleStart = async () => {
    setIsStarting(true)
    const result = await startProcessing(5)
    setRunState({ runId: result.runId, token: result.token })
    setIsStarting(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
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

      {runState ? (
        <ProgressDisplay runId={runState.runId} token={runState.token} />
      ) : (
        <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
          <p className="text-sm text-muted-foreground">
            Progress updates will appear here when you start the task
          </p>
          <div className="text-xs text-muted-foreground space-x-4">
            <CodeLink mapping={progressMappings["progress-stream"]}>
              <span className="underline decoration-dotted underline-offset-4">
                View stream definition
              </span>
            </CodeLink>
            <CodeLink mapping={progressMappings["stream-write"]}>
              <span className="underline decoration-dotted underline-offset-4">
                View stream.append()
              </span>
            </CodeLink>
          </div>
        </div>
      )}
    </div>
  )
}

function ProgressDisplay({ runId, token }: { runId: string; token: string }) {
  const { parts, error } = useRealtimeStream(progressStream, runId, {
    accessToken: token,
    timeoutInSeconds: 300,
  })

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/50 p-4 bg-red-500/10">
        <p className="text-sm text-red-500">Error: {error.message}</p>
      </div>
    )
  }

  const latestUpdate = parts?.[parts.length - 1]
  const percentage = latestUpdate
    ? Math.round((latestUpdate.current / latestUpdate.total) * 100)
    : 0
  const isComplete = latestUpdate?.steps?.every((s) => s.status === "completed")

  return (
    <div className="rounded-lg border p-4 bg-muted/30 space-y-4">
      <CodeLink mapping={progressMappings["stream-write"]}>
        <div className="space-y-2" data-code-id="progress-display">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {latestUpdate?.message || "Starting..."}
            </span>
            <span className="font-mono text-muted-foreground">{percentage}%</span>
          </div>
        </div>
      </CodeLink>

      {isComplete && (
        <p className="text-sm text-green-600 font-medium">Processing complete!</p>
      )}

      {latestUpdate?.steps && <StepIndicator steps={latestUpdate.steps} />}

      <div className="text-xs text-muted-foreground space-x-4 pt-2 border-t border-border">
        <CodeLink mapping={progressMappings["progress-stream"]}>
          <span className="underline decoration-dotted underline-offset-4">
            View stream definition
          </span>
        </CodeLink>
        <CodeLink mapping={progressMappings["stream-write"]}>
          <span className="underline decoration-dotted underline-offset-4">
            View stream.append()
          </span>
        </CodeLink>
      </div>
    </div>
  )
}

function StepIndicator({ steps }: { steps: Step[] }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Steps</p>
      <div className="flex items-start gap-2">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-start gap-2 flex-1">
            <div className="flex flex-col items-center gap-1 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200 ${
                  step.status === "completed"
                    ? "bg-green-500/20 text-green-600"
                    : step.status === "active"
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step.status === "completed" ? (
                  <Check className="w-4 h-4" />
                ) : step.status === "active" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Circle className="w-4 h-4" />
                )}
              </div>
              <span
                className={`text-xs font-medium text-center ${
                  step.status === "active" ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
              {step.status === "active" && (
                <span className="text-xs text-muted-foreground text-center">
                  {step.description}
                </span>
              )}
            </div>
            {index < steps.length - 1 && (
              <div
                className={`h-0.5 flex-1 mt-4 rounded-full ${
                  step.status === "completed" ? "bg-green-500/50" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
