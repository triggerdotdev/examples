"use client"

import { useEffect, useRef, useState, useCallback } from "react"

/**
 * Hook for auto-scrolling containers that pauses when user scrolls up.
 * Returns ref to attach to container and scroll state/handlers.
 */
export function useAutoScroll<T extends HTMLElement>(deps: unknown[]) {
  const containerRef = useRef<T>(null)
  const [isAutoScroll, setIsAutoScroll] = useState(true)

  // Auto-scroll when dependencies change (if not paused)
  useEffect(() => {
    if (isAutoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  // Pause auto-scroll when user scrolls away from bottom
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    setIsAutoScroll(isAtBottom)
  }, [])

  const resumeScroll = useCallback(() => {
    setIsAutoScroll(true)
  }, [])

  return { containerRef, isAutoScroll, handleScroll, resumeScroll }
}
