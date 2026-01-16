import { streams } from "@trigger.dev/sdk/v3"

export type Step = {
  id: string
  label: string
  description: string
  status: "pending" | "active" | "completed"
}

export type ProgressUpdate = {
  current: number
  total: number
  message: string
  steps: Step[]
  currentStepId: string
}

export const progressStream = streams.define<ProgressUpdate>({
  id: "progress",
})
