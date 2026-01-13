"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { submitTask } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { RunViewer } from "@/components/run-viewer"
import { Chat } from "@/components/chat"
import { AsciiLogo } from "@/components/ascii-logo"

type RunState = {
  runId: string
  accessToken: string
} | null

export function RalphApp() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string>()
  const [isPending, setIsPending] = useState(false)

  // Derive run state from URL
  const runIdFromUrl = searchParams.get("runId")
  const tokenFromUrl = searchParams.get("token")
  const runState: RunState = runIdFromUrl && tokenFromUrl
    ? { runId: runIdFromUrl, accessToken: tokenFromUrl }
    : null

  async function handleSubmit(formData: FormData) {
    setError(undefined)
    setIsPending(true)

    const result = await submitTask(formData)

    if (result.ok) {
      // Update URL with run state
      const params = new URLSearchParams()
      params.set("runId", result.value.runId)
      params.set("token", result.value.token)
      router.push(`?${params.toString()}`)
    } else {
      setError(result.error)
    }
    setIsPending(false)
  }

  function handleNewTask() {
    router.push("/")
    setError(undefined)
  }

  const isRunning = runState !== null

  return (
    <div className="flex h-screen">
      {/* Left sidebar */}
      <aside className="w-80 shrink-0 border-r bg-card flex flex-col">
        {/* ASCII Logo */}
        <div className="shrink-0 border-b">
          <AsciiLogo />
        </div>

        <div className="shrink-0 bg-card p-6 space-y-4">
          {/* New task button */}
          {isRunning && (
            <Button variant="outline" size="sm" onClick={handleNewTask} className="text-[12px] h-7">
              New task
            </Button>
          )}

          {/* Form */}
          <form action={handleSubmit} className="space-y-4">
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

            {!isRunning && (
              <Button
                type="submit"
                disabled={isPending}
                className="w-full text-[13px] font-medium h-9"
              >
                {isPending ? "Starting..." : "Start"}
              </Button>
            )}
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

        {/* Chat interface */}
        {runState && (
          <div className="flex-1 min-h-0 border-t">
            <Chat runId={runState.runId} accessToken={runState.accessToken} />
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
