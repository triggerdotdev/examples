"use client"

import { useState } from "react"
import { submitTask } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
      {/* Form - greyed out when running */}
      <Card className={isRunning ? "opacity-50 pointer-events-none" : ""}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Start a task</CardTitle>
          {isRunning && (
            <Button variant="outline" size="sm" onClick={handleNewTask}>
              New task
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="repoUrl">GitHub repository URL</Label>
              <Input
                id="repoUrl"
                name="repoUrl"
                type="url"
                placeholder="https://github.com/owner/repo"
                required
                disabled={isRunning}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt</Label>
              <Textarea
                id="prompt"
                name="prompt"
                placeholder="Describe what you want the agent to do..."
                rows={4}
                required
                disabled={isRunning}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pauseEvery">Pause for approval every N iterations</Label>
              <Input
                id="pauseEvery"
                name="pauseEvery"
                type="number"
                min={0}
                max={20}
                defaultValue={5}
                placeholder="5"
                disabled={isRunning}
              />
              <p className="text-xs text-gray-500">Set to 0 for no pauses</p>
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <Button type="submit" disabled={isPending || isRunning} className="w-full">
              {isPending ? "Starting..." : "Start task"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Run viewer - inline below form */}
      {runState && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              Run: <span className="font-mono text-sm">{runState.runId}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RunViewer runId={runState.runId} accessToken={runState.accessToken} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
