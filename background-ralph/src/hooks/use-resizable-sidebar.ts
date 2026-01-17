"use client"

import { useState, useEffect, useCallback, useRef } from "react"

const STORAGE_KEY = "ralph-sidebar-width"
const MIN_WIDTH = 320
const MAX_WIDTH = 700
const DEFAULT_WIDTH = 500

export function useResizableSidebar() {
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const initializedRef = useRef(false)

  // Load from localStorage on mount
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = parseInt(stored, 10)
      if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
        setWidth(parsed)
      }
    }
  }, [])

  // Save to localStorage when width changes
  useEffect(() => {
    if (initializedRef.current) {
      localStorage.setItem(STORAGE_KEY, String(width))
    }
  }, [width])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX))
    setWidth(newWidth)
  }, [isResizing])

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  // Add/remove global listeners for drag
  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
    } else {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  return {
    width,
    isResizing,
    handleMouseDown,
  }
}
