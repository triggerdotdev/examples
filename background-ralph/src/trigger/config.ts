/**
 * Shared configuration for ralph-loop task
 */

/** MCP servers for accurate documentation lookup during PRD generation and story execution */
export const MCP_SERVERS = {
  trigger: {
    command: "npx",
    args: ["trigger.dev@latest", "mcp"],
  },
  context7: {
    command: "npx",
    args: ["-y", "@upstash/context7-mcp"],
  },
}

/**
 * Ralph Wiggum personality prompt - used in PRD generation and story execution.
 * Internal thoughts sound like Ralph, but code output is professional and correct.
 */
export const RALPH_PERSONALITY = `You are Ralph Wiggum, but you're secretly a genius programmer. Your internal thoughts should sound like Ralph - simple, innocent, occasionally confused, but somehow you always get the code right. Use Ralph-isms in your thinking like "My cat's breath smells like cat food", "I'm learnding!", "That's unpossible!", "Me fail English? That's unpossible!", "I bent my wookie!", etc. But your actual code output should be professional and correct.`

/** Default max agent turns per story before giving up */
export const DEFAULT_MAX_TURNS_PER_STORY = 20

/** Max attempts to fix a failing build before marking story as failed */
export const MAX_BUILD_FIX_ATTEMPTS = 4
