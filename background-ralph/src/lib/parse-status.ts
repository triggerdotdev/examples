/**
 * Utilities for parsing status stream data
 */
import type { StatusUpdate, Prd } from "@/trigger/streams"

/**
 * Parse raw status stream parts into StatusUpdate objects.
 * Handles JSON parse errors gracefully.
 */
export function parseStatusParts(rawParts: string[]): StatusUpdate[] {
  return rawParts.map((part) => {
    try {
      return JSON.parse(part) as StatusUpdate
    } catch {
      return { type: "error", message: `Parse error: ${part}` } as StatusUpdate
    }
  })
}

/**
 * Extract PRD from status updates.
 * prd_generated takes precedence over prd_review.
 */
export function extractPrdFromStatus(parts: StatusUpdate[]): Prd | null {
  return parts.reduce<Prd | null>((acc, s) => {
    if (s.type === "prd_generated" && s.prd) return s.prd
    if (s.type === "prd_review" && s.prd && !acc) return s.prd
    return acc
  }, null)
}

/**
 * Extract completed story IDs from status updates.
 */
export function extractCompletedStories(parts: StatusUpdate[]): Set<string> {
  const completed = new Set<string>()
  for (const s of parts) {
    if (s.type === "story_complete" && s.story?.id) {
      completed.add(s.story.id)
    }
  }
  return completed
}

/**
 * Extract failed story IDs from status updates.
 */
export function extractFailedStories(parts: StatusUpdate[]): Set<string> {
  const failed = new Set<string>()
  for (const s of parts) {
    if (s.type === "story_failed" && s.story?.id) {
      failed.add(s.story.id)
    }
  }
  return failed
}

/**
 * Get the current story ID from status updates.
 * Returns undefined if no story is in progress.
 */
export function getCurrentStoryId(parts: StatusUpdate[]): string | undefined {
  return parts.reduce<string | undefined>((acc, s) => {
    if (s.type === "story_start" && s.story?.id) return s.story.id
    if (s.type === "story_complete" && s.story?.id === acc) return undefined
    if (s.type === "story_failed" && s.story?.id === acc) return undefined
    return acc
  }, undefined)
}

/**
 * Get latest progress string from status updates.
 */
export function getLatestProgress(parts: StatusUpdate[]): string | null {
  for (let i = parts.length - 1; i >= 0; i--) {
    const s = parts[i]
    if (s.type === "story_complete" && s.progress) {
      return s.progress
    }
  }
  return null
}
