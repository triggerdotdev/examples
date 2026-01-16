import { streams } from "@trigger.dev/sdk/v3"

export type ProgressUpdate = {
  current: number
  total: number
  message: string
}

export const progressStream = streams.define<ProgressUpdate>({
  id: "progress",
})
