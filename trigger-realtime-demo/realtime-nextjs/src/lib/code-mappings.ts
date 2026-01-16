// Maps UI element IDs to their corresponding code locations
// Used to highlight code when user interacts with UI elements

export type CodeMapping = {
  file: string
  lines: [number, number]
  description?: string
}

// Progress tracking example mappings
export const progressMappings: Record<string, CodeMapping> = {
  // Button triggers task via server action
  "trigger-button": {
    file: "actions.ts",
    lines: [6, 10],
    description: "tasks.trigger() starts the task",
  },
  // Progress stream definition
  "progress-stream": {
    file: "streams.ts",
    lines: [8, 10],
    description: "streams.define() creates the stream",
  },
  // Task writing to stream
  "stream-write": {
    file: "task.ts",
    lines: [14, 19],
    description: "progressStream.write() sends updates",
  },
  // Task definition
  "task-definition": {
    file: "task.ts",
    lines: [4, 7],
    description: "Task configuration with id and maxDuration",
  },
  // Public token for realtime access
  "public-token": {
    file: "actions.ts",
    lines: [12, 14],
    description: "auth.createPublicToken() for frontend access",
  },
}
