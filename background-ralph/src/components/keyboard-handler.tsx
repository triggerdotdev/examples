"use client"

import { useEffect, useCallback } from "react"

type Props = {
  onContinue?: () => void
  onStop?: () => void
  onEdit?: () => void
  onHelp: () => void
  onNavigateUp?: () => void
  onNavigateDown?: () => void
  disabled?: boolean
}

export function useKeyboardShortcuts({
  onContinue,
  onStop,
  onEdit,
  onHelp,
  onNavigateUp,
  onNavigateDown,
  disabled,
}: Props) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't fire shortcuts when typing in inputs
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return
      }

      if (disabled) return

      switch (e.key.toLowerCase()) {
        case "c":
          e.preventDefault()
          onContinue?.()
          break
        case "s":
          e.preventDefault()
          onStop?.()
          break
        case "e":
          e.preventDefault()
          onEdit?.()
          break
        case "?":
          e.preventDefault()
          onHelp()
          break
        case "arrowup":
        case "k":
          e.preventDefault()
          onNavigateUp?.()
          break
        case "arrowdown":
        case "j":
          e.preventDefault()
          onNavigateDown?.()
          break
        case "escape":
          // Let modals handle escape
          break
      }
    },
    [onContinue, onStop, onEdit, onHelp, onNavigateUp, onNavigateDown, disabled]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])
}
