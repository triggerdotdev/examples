"use client"

import { useState } from "react"
import { useWaitToken } from "@trigger.dev/react-hooks"

/**
 * Hook for managing waitpoint approval flows.
 * Handles loading state, error state, and completion for approval buttons.
 */
export function useApprovalFlow(tokenId: string, accessToken: string) {
  const [submittedAction, setSubmittedAction] = useState<string | null>(null)
  const [error, setError] = useState<string>()
  const [isCompleted, setIsCompleted] = useState(false)
  const { complete } = useWaitToken(tokenId, { accessToken })

  async function submit<T extends Record<string, unknown>>(payload: T) {
    const action = payload.action as string | undefined
    setSubmittedAction(action ?? "submitting")
    setError(undefined)
    try {
      await complete(payload)
      setIsCompleted(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed")
      setSubmittedAction(null)
    }
  }

  return { submittedAction, error, isCompleted, submit }
}
