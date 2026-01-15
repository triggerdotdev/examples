"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useRealtimeRun } from "@trigger.dev/react-hooks"
import { submitTask, cancelRun } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { RunViewer } from "@/components/run-viewer"
import { Chat } from "@/components/chat"
import { AsciiLogo } from "@/components/ascii-logo"
import { HelpModal } from "@/components/help-modal"
import { useKeyboardShortcuts } from "@/components/keyboard-handler"
import type { ralphLoop } from "@/trigger/ralph-loop"

const terminalStatuses = ["COMPLETED", "CANCELED", "FAILED", "CRASHED", "SYSTEM_FAILURE", "TIMED_OUT", "EXPIRED"]

type RunState = {
  runId: string
  accessToken: string
} | null

export function RalphApp() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string>()
  const [isPending, setIsPending] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [isCanceling, setIsCanceling] = useState(false)
  const [cancelError, setCancelError] = useState<string>()

  // Keyboard shortcut for ? (help modal)
  useKeyboardShortcuts({
    onHelp: () => setIsHelpOpen(true),
  })

  // Derive run state from URL
  const runIdFromUrl = searchParams.get("runId")
  const tokenFromUrl = searchParams.get("token")
  const repoFromUrl = searchParams.get("repo")
  const promptFromUrl = searchParams.get("prompt")
  const runState: RunState = runIdFromUrl && tokenFromUrl
    ? { runId: runIdFromUrl, accessToken: tokenFromUrl }
    : null

  // Track run status for sidebar controls
  const { run } = useRealtimeRun<typeof ralphLoop>(runState?.runId ?? "", {
    accessToken: runState?.accessToken ?? "",
    enabled: !!runState,
  })
  const isRunActive = run?.status && !terminalStatuses.includes(run.status)

  async function handleCancel() {
    if (!runState) return
    setIsCanceling(true)
    setCancelError(undefined)
    const result = await cancelRun(runState.runId)
    if (!result.ok) {
      setCancelError(result.error)
    }
    setIsCanceling(false)
  }

  async function handleSubmit(formData: FormData) {
    setError(undefined)
    setIsPending(true)

    const result = await submitTask(formData)

    if (result.ok) {
      // Update URL with run state
      const params = new URLSearchParams()
      params.set("runId", result.value.runId)
      params.set("token", result.value.token)
      params.set("repo", formData.get("repoUrl") as string)
      params.set("prompt", formData.get("prompt") as string)
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
          <AsciiLogo isRunning={isRunning} />
        </div>

        {isRunning ? (
          /* Compact header when running */
          <div className="shrink-0 bg-card p-4 space-y-3 border-b">
            {/* Repo link */}
            {repoFromUrl && (
              <a
                href={repoFromUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[13px] font-medium text-foreground hover:text-primary transition-colors"
              >
                <span className="truncate">{repoFromUrl.replace("https://github.com/", "")}</span>
                <svg className="w-3 h-3 shrink-0 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}

            {/* Prompt summary */}
            {promptFromUrl && (
              <p className="text-[12px] text-slate-600 line-clamp-2" title={promptFromUrl}>
                {promptFromUrl}
              </p>
            )}

            {/* Run status + cancel */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                {isRunActive && (
                  <span className="inline-block text-[14px] animate-blink" title="Ralph is working...">🍩</span>
                )}
                <span className="text-[11px] font-mono text-slate-500">
                  {runState.runId.slice(0, 12)}...
                </span>
              </div>
              {isRunActive ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isCanceling}
                  className="h-6 text-[11px] px-2"
                >
                  {isCanceling ? "..." : "Cancel"}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNewTask}
                  className="h-6 text-[11px] px-2"
                >
                  New task
                </Button>
              )}
            </div>
            {cancelError && (
              <p className="text-[11px] text-red-500">{cancelError}</p>
            )}
          </div>
        ) : (
          /* Form when not running */
          <div className="shrink-0 bg-card p-6 space-y-4">
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
                  className="text-[13px] resize-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="yoloMode"
                  name="yoloMode"
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
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
                disabled={isPending}
                className="w-full text-[13px] font-medium h-9"
              >
                {isPending ? "Starting..." : "Start"}
              </Button>
            </form>
          </div>
        )}

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
            <RunViewer runId={runState.runId} accessToken={runState.accessToken} onCancel={handleCancel} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-[14px] text-muted-foreground">
              Submit a task to get started
            </p>
          </div>
        )}
      </main>

      {/* Help modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  )
}
