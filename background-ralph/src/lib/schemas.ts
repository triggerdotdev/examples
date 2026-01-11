import { z } from "zod"

const githubUrlRegex = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\/.*)?$/

export const submitTaskSchema = z.object({
  repoUrl: z
    .string()
    .min(1, "Repository URL is required")
    .regex(githubUrlRegex, "Must be a valid GitHub repository URL"),
  prompt: z.string().min(1, "Prompt is required").max(4000, "Prompt too long"),
  pauseEvery: z.coerce.number().int().min(0).max(20).default(5),
})

export type SubmitTaskInput = z.infer<typeof submitTaskSchema>
