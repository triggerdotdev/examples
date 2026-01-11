"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { submitTask } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function SubmitForm() {
  const router = useRouter()
  const [error, setError] = useState<string>()
  const [isPending, setIsPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(undefined)
    setIsPending(true)

    const result = await submitTask(formData)

    if (result.ok) {
      router.push(`/run/${result.value.runId}`)
    } else {
      setError(result.error)
      setIsPending(false)
    }
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Start a task</CardTitle>
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
            />
            <p className="text-xs text-gray-500">Set to 0 for no pauses</p>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Starting..." : "Start task"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
