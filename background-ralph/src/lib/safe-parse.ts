/**
 * Type-safe JSON parsing utilities using Zod
 */
import { z } from "zod"

/**
 * Safely parse JSON string with Zod schema validation.
 * Returns null on parse failure instead of throwing.
 */
export function safeParse<T>(schema: z.ZodType<T>, json: string): T | null {
  try {
    return schema.parse(JSON.parse(json))
  } catch {
    return null
  }
}

/**
 * Get error message from unknown error value.
 * Handles Error instances and falls back to String() for others.
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
