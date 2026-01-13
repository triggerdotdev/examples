"use client"

import { useState } from "react"
import { submitTask } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { RunViewer } from "@/components/run-viewer"

type RunState = {
  runId: string
  accessToken: string
} | null

export function RalphApp() {
  const [error, setError] = useState<string>()
  const [isPending, setIsPending] = useState(false)
  const [runState, setRunState] = useState<RunState>(null)

  async function handleSubmit(formData: FormData) {
    setError(undefined)
    setIsPending(true)

    const result = await submitTask(formData)

    if (result.ok) {
      setRunState({
        runId: result.value.runId,
        accessToken: result.value.token,
      })
    } else {
      setError(result.error)
    }
    setIsPending(false)
  }

  function handleNewTask() {
    setRunState(null)
    setError(undefined)
  }

  const isRunning = runState !== null

  return (
    <div className="w-full max-w-4xl space-y-8">
      {/* Form section */}
      <div className={`bg-card border rounded-md p-6 ${isRunning ? "opacity-50 pointer-events-none" : ""}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[16px] font-semibold tracking-tight">Start a task</h2>
          {isRunning && (
            <Button variant="outline" size="sm" onClick={handleNewTask} className="text-[13px]">
              New task
            </Button>
          )}
        </div>

        <form action={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="repoUrl" className="text-[13px]">
              GitHub repository URL
            </Label>
            <Input
              id="repoUrl"
              name="repoUrl"
              type="url"
              placeholder="https://github.com/owner/repo"
              required
              disabled={isRunning}
              className="text-[14px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prompt" className="text-[13px]">
              Prompt
            </Label>
            <Textarea
              id="prompt"
              name="prompt"
              placeholder="Describe what you want the agent to do..."
              rows={4}
              required
              disabled={isRunning}
              className="text-[14px] resize-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              id="yoloMode"
              name="yoloMode"
              type="checkbox"
              className="h-4 w-4 rounded border-border accent-primary"
              disabled={isRunning}
            />
            <Label htmlFor="yoloMode" className="text-[13px] font-normal text-muted-foreground">
              Yolo mode (skip approval between stories)
            </Label>
          </div>

          {error && (
            <p className="text-[13px] text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            disabled={isPending || isRunning}
            className="w-full text-[14px] font-medium"
          >
            {isPending ? "Starting..." : "Start task"}
          </Button>
        </form>
      </div>

      {/* Run viewer */}
      {runState && (
        <div className="bg-card border rounded-md overflow-hidden">
          <div className="px-6 py-4 border-b bg-muted/30">
            <span className="text-[13px] text-muted-foreground">Run </span>
            <span className="text-[13px] font-mono">{runState.runId}</span>
          </div>
          <div className="p-6">
            <RunViewer runId={runState.runId} accessToken={runState.accessToken} />
          </div>
        </div>
      )}
    </div>
  )
}
