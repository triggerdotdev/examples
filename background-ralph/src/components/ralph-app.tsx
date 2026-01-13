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
    <div className="flex h-screen">
      {/* Left sidebar */}
      <aside className="w-80 shrink-0 border-r bg-card overflow-y-auto">
        <div className="sticky top-0 bg-card p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-[16px] font-semibold tracking-tight">Background Ralph</h1>
            {isRunning && (
              <Button variant="outline" size="sm" onClick={handleNewTask} className="text-[12px] h-7">
                New
              </Button>
            )}
          </div>

          {/* Form */}
          <form action={handleSubmit} className={`space-y-4 ${isRunning ? "opacity-50 pointer-events-none" : ""}`}>
            <div className="space-y-1.5">
              <Label htmlFor="repoUrl" className="text-[12px]">
                Repository URL
              </Label>
              <Input
                id="repoUrl"
                name="repoUrl"
                type="url"
                placeholder="https://github.com/owner/repo"
                required
                disabled={isRunning}
                className="text-[13px] h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prompt" className="text-[12px]">
                Prompt
              </Label>
              <Textarea
                id="prompt"
                name="prompt"
                placeholder="What should the agent do?"
                rows={3}
                required
                disabled={isRunning}
                className="text-[13px] resize-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="yoloMode"
                name="yoloMode"
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-border accent-primary"
                disabled={isRunning}
              />
              <Label htmlFor="yoloMode" className="text-[12px] font-normal text-muted-foreground">
                Yolo mode
              </Label>
            </div>

            {error && (
              <p className="text-[12px] text-destructive">{error}</p>
            )}

            <Button
              type="submit"
              disabled={isPending || isRunning}
              className="w-full text-[13px] font-medium h-9"
            >
              {isPending ? "Starting..." : "Start"}
            </Button>
          </form>

          {/* Run info */}
          {runState && (
            <div className="pt-4 border-t">
              <p className="text-[11px] text-muted-foreground">
                Run <span className="font-mono">{runState.runId.slice(0, 12)}...</span>
              </p>
            </div>
          )}
        </div>

        {/* Chat interface placeholder (US-021) */}
        {runState && (
          <div className="p-6 pt-0">
            <div className="text-[11px] text-muted-foreground">
              Chat interface coming in US-021
            </div>
          </div>
        )}
      </aside>

      {/* Right main area */}
      <main className="flex-1 overflow-y-auto bg-background">
        {runState ? (
          <div className="p-6">
            <RunViewer runId={runState.runId} accessToken={runState.accessToken} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-[14px] text-muted-foreground">
              Submit a task to get started
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
