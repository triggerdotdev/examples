// =============================================================================
// CODE MAPPINGS
// =============================================================================
// This file defines the mapping between UI elements and their corresponding
// code locations. When a user clicks on an element wrapped in <CodeLink>,
// the CodePanel highlights the lines specified in these mappings.
//
// How to add a new mapping:
// 1. Identify the UI element you want to make interactive
// 2. Determine which file and lines in the display code are relevant
// 3. Add a new entry to the mappings object with a unique key
// 4. Wrap the UI element with <CodeLink mapping={mappings["your-key"]}>
//
// Note: Line numbers refer to the DISPLAY code in page.tsx, not the actual
// source files. The display code is a simplified version for demonstration.
// =============================================================================

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Represents a mapping from a UI element to a code location.
 */
export type CodeMapping = {
  // Which file to show (matches the "name" property in CodeFile)
  file: string
  // Start and end line numbers to highlight (1-indexed, inclusive)
  lines: [number, number]
  // Optional description shown as tooltip on hover
  description?: string
}

// =============================================================================
// PROGRESS TRACKING EXAMPLE MAPPINGS
// =============================================================================

/**
 * Mappings for the Progress Tracking example.
 *
 * Each key corresponds to a UI element that can be clicked to highlight code.
 * The values define which file and lines to highlight when clicked.
 */
export const progressMappings: Record<string, CodeMapping> = {
  // tasks.trigger() in the server action
  "trigger-button": {
    file: "actions.ts",
    lines: [10, 15],
    description: "tasks.trigger() starts a new run of the task",
  },

  // streams.define() creates a typed stream
  "progress-stream": {
    file: "streams.ts",
    lines: [14, 16],
    description: "streams.define() creates a typed stream for real-time data",
  },

  // progressStream.append() sends updates to frontend
  "stream-write": {
    file: "task.ts",
    lines: [21, 27],
    description: "progressStream.append() sends progress to the frontend instantly",
  },

  // Task definition with id and maxDuration
  "task-definition": {
    file: "task.ts",
    lines: [6, 11],
    description: "Task config: id for triggering, maxDuration for timeout",
  },

  // auth.createPublicToken() for frontend access
  "public-token": {
    file: "actions.ts",
    lines: [17, 20],
    description: "Public token scoped to read only this specific run",
  },
}
