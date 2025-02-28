export const ERROR_MESSAGES = {
  API_KEY: {
    title: "API Key Error",
    description: "There was an issue with the API key. Please check that it's correctly configured and valid.",
  },
  RATE_LIMIT: {
    title: "Too Many Requests",
    description: "You've reached the rate limit. Please wait a moment before trying again.",
  },
  NETWORK: {
    title: "Connection Error",
    description: "Unable to reach Claude's API. Please check your internet connection and try again.",
  },
  VALIDATION: {
    title: "Invalid Request",
    description: "The request format was invalid. Please try again.",
  },
  MODEL_ERROR: {
    title: "Model Error",
    description: "Claude encountered an error processing your request. Please try again.",
  },
  TIMEOUT: {
    title: "Request Timeout",
    description: "The request took too long to complete. Please try again.",
  },
  CONTENT_FILTER: {
    title: "Content Filtered",
    description: "Your message was flagged by our content filter. Please revise and try again.",
  },
  UNKNOWN: {
    title: "Unexpected Error",
    description:
      "Something went wrong while connecting to Claude. Please try again or check the console for more details.",
  },
} as const

export type ErrorType = keyof typeof ERROR_MESSAGES

export function getErrorMessage(error: unknown): { title: string; description: string } {
  // If error is a string and matches our error types
  if (typeof error === "string" && error in ERROR_MESSAGES) {
    return ERROR_MESSAGES[error as ErrorType]
  }

  // If error is an object with a message property
  if (error && typeof error === "object" && "message" in error) {
    const message = (error.message as string).toLowerCase()

    // Check for specific error patterns
    if (message.includes("api key") || message.includes("unauthorized")) {
      return ERROR_MESSAGES.API_KEY
    }
    if (message.includes("rate limit")) {
      return ERROR_MESSAGES.RATE_LIMIT
    }
    if (message.includes("network") || message.includes("connection")) {
      return ERROR_MESSAGES.NETWORK
    }
    if (message.includes("timeout")) {
      return ERROR_MESSAGES.TIMEOUT
    }
    if (message.includes("content filter")) {
      return ERROR_MESSAGES.CONTENT_FILTER
    }
    if (message.includes("model")) {
      return ERROR_MESSAGES.MODEL_ERROR
    }
  }

  // Default to unknown error
  return ERROR_MESSAGES.UNKNOWN
}

