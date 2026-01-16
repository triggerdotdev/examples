"use server"

// =============================================================================
// SERVER ACTIONS
// =============================================================================
// Server Actions are functions that run on the server but can be called from
// client components. They're perfect for:
// - Triggering Trigger.dev tasks (keeps your TRIGGER_SECRET_KEY on the server)
// - Creating public tokens for real-time subscriptions
// - Database operations
//
// The "use server" directive at the top marks all exports as server actions.
// =============================================================================

import { tasks, auth } from "@trigger.dev/sdk/v3"
import type { processDataTask } from "@/trigger/tasks"

// =============================================================================
// START PROCESSING ACTION
// =============================================================================

/**
 * Triggers the processDataTask and returns credentials for real-time subscription.
 *
 * This is the bridge between your frontend and Trigger.dev:
 * 1. Frontend calls this server action
 * 2. Server action triggers the task using the secret key (never exposed to client)
 * 3. Server action creates a scoped public token for the specific run
 * 4. Frontend uses the runId + token to subscribe to real-time updates
 *
 * @param itemCount - Number of items for the task to process
 * @returns Object containing runId and public access token
 */
export async function startProcessing(itemCount: number) {
  // ---------------------------------------------------------------------------
  // STEP 1: TRIGGER THE TASK
  // ---------------------------------------------------------------------------
  // tasks.trigger() starts a new run of the specified task.
  //
  // We use the generic type <typeof processDataTask> for type safety:
  // - The task ID must match a real task ("process-data")
  // - The payload must match the task's expected shape ({ items: number })
  //
  // IMPORTANT: Use a type-only import for the task to avoid bundling task code
  // into your frontend bundle. The "type" keyword ensures only types are imported.
  // ---------------------------------------------------------------------------
  const handle = await tasks.trigger<typeof processDataTask>(
    "process-data",    // Task ID - must match the id in task definition
    { items: itemCount } // Payload - typed based on the task's run function
  )

  // ---------------------------------------------------------------------------
  // STEP 2: CREATE A PUBLIC ACCESS TOKEN
  // ---------------------------------------------------------------------------
  // Public tokens allow frontend code to subscribe to real-time updates.
  // They're scoped to specific permissions - in this case, read-only access
  // to a single run.
  //
  // Scoping tokens is important for security:
  // - The token can ONLY read this specific run (handle.id)
  // - The token cannot trigger tasks or access other runs
  // - The token expires automatically
  // ---------------------------------------------------------------------------
  const token = await auth.createPublicToken({
    scopes: {
      read: {
        runs: [handle.id], // Only allow reading this specific run
      },
    },
  })

  // ---------------------------------------------------------------------------
  // STEP 3: RETURN CREDENTIALS TO FRONTEND
  // ---------------------------------------------------------------------------
  // The frontend needs both pieces to subscribe to real-time updates:
  // - runId: Identifies which run to subscribe to
  // - token: Authenticates the subscription request
  // ---------------------------------------------------------------------------
  return {
    runId: handle.id,
    token,
  }
}
