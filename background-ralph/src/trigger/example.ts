import { task } from "@trigger.dev/sdk"

export const helloWorld = task({
  id: "hello-world",
  maxDuration: 300,
  run: async (payload: { message: string }) => {
    console.log("Hello from Background Ralph!", payload.message)
    return { success: true }
  },
})
