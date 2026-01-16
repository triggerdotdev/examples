import { task } from "@trigger.dev/sdk/v3"
import { progressStream, Step } from "./streams"

// =============================================================================
// TASK DEFINITIONS
// =============================================================================
// Tasks are the core building blocks of Trigger.dev. They run in the cloud
// with automatic retries, logging, and real-time monitoring.
// =============================================================================

/**
 * Helper function to create the initial steps array.
 * All steps start as "pending" and get updated as the task progresses.
 */
function createInitialSteps(): Step[] {
  return [
    {
      id: "init",
      label: "Initialize",
      description: "Setting up the task and validating payload",
      status: "pending",
    },
    {
      id: "process",
      label: "Process",
      description: "Processing each item in the payload",
      status: "pending",
    },
    {
      id: "finalize",
      label: "Finalize",
      description: "Cleaning up and preparing results",
      status: "pending",
    },
  ]
}

/**
 * Helper function to update step statuses.
 * Marks the current step as "active" and all previous steps as "completed".
 */
function updateSteps(steps: Step[], currentStepId: string): Step[] {
  let foundCurrent = false

  return steps.map((step) => {
    if (step.id === currentStepId) {
      foundCurrent = true
      return { ...step, status: "active" as const }
    }
    // Steps before current are completed, steps after are pending
    return {
      ...step,
      status: foundCurrent ? ("pending" as const) : ("completed" as const),
    }
  })
}

/**
 * Process Data Task
 *
 * This task demonstrates how to:
 * 1. Accept a typed payload ({ items: number })
 * 2. Stream real-time progress updates to the frontend
 * 3. Use step-based progress tracking for better UX
 *
 * The task processes a configurable number of items, streaming progress
 * updates after each item is processed. The frontend receives these
 * updates in real-time via useRealtimeStream().
 */
export const processDataTask = task({
  // Unique identifier for this task - used when triggering from your app
  id: "process-data",

  // Maximum time this task can run (in seconds)
  // After this, the task will be terminated
  maxDuration: 300,

  // The run function contains your task logic
  // It receives the payload and can return a result
  run: async (payload: { items: number }) => {
    const total = payload.items
    let steps = createInitialSteps()

    // =========================================================================
    // STEP 1: Initialize
    // =========================================================================
    // Validate the payload and set up any resources needed for processing
    steps = updateSteps(steps, "init")
    await progressStream.append({
      current: 0,
      total,
      message: "Initializing task...",
      steps,
      currentStepId: "init",
    })

    // Simulate initialization work (e.g., connecting to a database)
    await new Promise((r) => setTimeout(r, 500))

    // =========================================================================
    // STEP 2: Process Items
    // =========================================================================
    // Loop through each item and process it, streaming updates after each one
    steps = updateSteps(steps, "process")

    for (let i = 0; i < total; i++) {
      // Simulate processing work (e.g., API call, computation, etc.)
      await new Promise((r) => setTimeout(r, 500))

      // Stream progress update to the frontend
      // The frontend will receive this instantly via useRealtimeStream()
      await progressStream.append({
        current: i + 1,
        total,
        message: `Processing item ${i + 1} of ${total}...`,
        steps,
        currentStepId: "process",
      })
    }

    // =========================================================================
    // STEP 3: Finalize
    // =========================================================================
    // Clean up resources and prepare the final result
    steps = updateSteps(steps, "finalize")
    await progressStream.append({
      current: total,
      total,
      message: "Finalizing results...",
      steps,
      currentStepId: "finalize",
    })

    // Simulate finalization work
    await new Promise((r) => setTimeout(r, 300))

    // Mark all steps as completed
    steps = steps.map((s) => ({ ...s, status: "completed" as const }))
    await progressStream.append({
      current: total,
      total,
      message: "Complete!",
      steps,
      currentStepId: "finalize",
    })

    // Return the result - this will be available in the run's output
    return { processed: total }
  },
})
