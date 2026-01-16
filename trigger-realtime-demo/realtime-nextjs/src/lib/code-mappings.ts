// Maps UI elements to code locations for highlighting
// Line numbers refer to the DISPLAY code in page.tsx, not actual source files

export type CodeMapping = {
  file: string
  lines: [number, number]
  description?: string
}

export const progressMappings: Record<string, CodeMapping> = {
  "trigger-button": {
    file: "actions.ts",
    lines: [10, 15],
    description: "tasks.trigger() starts a new run of the task",
  },
  "progress-stream": {
    file: "streams.ts",
    lines: [14, 16],
    description: "streams.define() creates a typed stream for real-time data",
  },
  "stream-write": {
    file: "task.ts",
    lines: [21, 27],
    description: "progressStream.append() sends progress to the frontend instantly",
  },
  "task-definition": {
    file: "task.ts",
    lines: [6, 11],
    description: "Task config: id for triggering, maxDuration for timeout",
  },
  "public-token": {
    file: "actions.ts",
    lines: [17, 20],
    description: "Public token scoped to read only this specific run",
  },
}
