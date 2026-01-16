import { streams } from "@trigger.dev/sdk/v3"

// =============================================================================
// STREAM TYPE DEFINITIONS
// =============================================================================
// Streams allow you to send real-time data from your Trigger.dev tasks
// to your frontend. Define the shape of your data here for type safety.
// =============================================================================

/**
 * Represents a single step in the task execution.
 * Each step has a unique ID, label, description, and status.
 */
export type Step = {
  id: string           // Unique identifier for the step (e.g., "init", "process", "finalize")
  label: string        // Short label shown in the UI (e.g., "Initialize")
  description: string  // Longer description of what this step does
  status: "pending" | "active" | "completed"
}

/**
 * Progress update sent from the task to the frontend.
 * Contains both numeric progress and step-based status.
 */
export type ProgressUpdate = {
  // Numeric progress tracking
  current: number      // Current item being processed (1-indexed)
  total: number        // Total number of items to process
  message: string      // Human-readable status message

  // Step-based progress tracking
  steps: Step[]        // Array of all steps with their current status
  currentStepId: string // ID of the currently active step
}

// =============================================================================
// STREAM DEFINITIONS
// =============================================================================
// Use streams.define() to create a typed stream. This gives you:
// - Type safety when writing to the stream in your task
// - Type safety when reading from the stream in your frontend
// - Auto-completion in your IDE
// =============================================================================

/**
 * The progress stream sends real-time updates about task execution.
 * Frontend components subscribe to this stream using useRealtimeStream().
 */
export const progressStream = streams.define<ProgressUpdate>({
  id: "progress",  // Unique ID for this stream - used to subscribe on frontend
})
