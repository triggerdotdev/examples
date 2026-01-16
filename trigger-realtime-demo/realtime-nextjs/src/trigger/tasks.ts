import { task } from "@trigger.dev/sdk/v3"
import { progressStream, Step } from "./streams"

function createInitialSteps(): Step[] {
  return [
    { id: "init", label: "Initialize", description: "Setting up the task", status: "pending" },
    { id: "process", label: "Process", description: "Processing items", status: "pending" },
    { id: "finalize", label: "Finalize", description: "Preparing results", status: "pending" },
  ]
}

// Marks current step as active, previous as completed
function updateSteps(steps: Step[], currentStepId: string): Step[] {
  let foundCurrent = false
  return steps.map((step) => {
    if (step.id === currentStepId) {
      foundCurrent = true
      return { ...step, status: "active" as const }
    }
    return { ...step, status: foundCurrent ? ("pending" as const) : ("completed" as const) }
  })
}

export const processDataTask = task({
  id: "process-data",
  maxDuration: 300,
  run: async (payload: { items: number }) => {
    const total = payload.items
    let steps = createInitialSteps()

    // Step 1: Initialize
    steps = updateSteps(steps, "init")
    await progressStream.append({
      current: 0, total, message: "Initializing...", steps, currentStepId: "init",
    })
    await new Promise((r) => setTimeout(r, 500))

    // Step 2: Process items
    steps = updateSteps(steps, "process")
    for (let i = 0; i < total; i++) {
      await new Promise((r) => setTimeout(r, 500))
      await progressStream.append({
        current: i + 1, total, message: `Processing item ${i + 1} of ${total}...`,
        steps, currentStepId: "process",
      })
    }

    // Step 3: Finalize
    steps = updateSteps(steps, "finalize")
    await progressStream.append({
      current: total, total, message: "Finalizing...", steps, currentStepId: "finalize",
    })
    await new Promise((r) => setTimeout(r, 300))

    // Mark complete
    steps = steps.map((s) => ({ ...s, status: "completed" as const }))
    await progressStream.append({
      current: total, total, message: "Complete!", steps, currentStepId: "finalize",
    })

    return { processed: total }
  },
})
