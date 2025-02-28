import { z } from "zod"

export const MessageSchema = z.object({
  id: z.string(),
  content: z.string(),
  role: z.enum(["user", "assistant", "system", "data"]),
  parts: z
    .array(
      z.object({
        type: z.enum(["text", "reasoning"]),
        text: z.string().optional(),
        details: z
          .array(
            z.object({
              type: z.enum(["text", "redacted"]),
              text: z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
})

export const ChatResponseSchema = z.object({
  messages: z.array(MessageSchema),
  error: z
    .object({
      message: z.string(),
      code: z.string(),
    })
    .optional(),
})

export type ChatError = {
  message: string
  code: string
  action?: string
}

export const ERROR_MESSAGES: Record<string, ChatError> = {
  NO_API_KEY: {
    message: "API key is not configured",
    code: "NO_API_KEY",
    action: "Please add your API key in the environment variables.",
  },
  RATE_LIMIT: {
    message: "Too many requests",
    code: "RATE_LIMIT",
    action: "Please try again in a few moments.",
  },
  CONNECTION_ERROR: {
    message: "Unable to connect to the AI service",
    code: "CONNECTION_ERROR",
    action: "Please check your internet connection and try again.",
  },
  INVALID_RESPONSE: {
    message: "Received an invalid response",
    code: "INVALID_RESPONSE",
    action: "Please try again or contact support if the issue persists.",
  },
}

