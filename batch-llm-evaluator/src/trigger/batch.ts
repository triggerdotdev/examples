import { db } from "@/lib/db";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { xai } from "@ai-sdk/xai";
import { batch, metadata, schemaTask } from "@trigger.dev/sdk/v3";
import { streamText, type TextStreamPart } from "ai";
import { z } from "zod";

export type LLMProviders = "anthropic" | "xai" | "openai";

export type STREAMS = {
  llm: TextStreamPart<{}>;
};

export const evaluateModels = schemaTask({
  id: "eval-models",
  description: "Evaluate the prompt on multiple models",
  schema: z.object({
    id: z.string(),
  }),
  run: async ({ id }) => {
    const evaluation = await db.evaluation.findUniqueOrThrow({
      where: { id },
    });

    const result = await batch.triggerByTaskAndWait([
      {
        task: evaluateOpenAI,
        payload: {
          prompt: evaluation.prompt,
          evalId: evaluation.id,
          settings: { user: "user-12345", model: "o1-preview" },
        },
        options: {
          tags: ["openai", `eval:${evaluation.id}`],
        },
      },
      {
        task: evaluateXAI,
        payload: { prompt: evaluation.prompt, evalId: evaluation.id },
        options: {
          tags: ["xai", `eval:${evaluation.id}`],
        },
      },
      {
        task: evaluateAnthropic,
        payload: {
          prompt: evaluation.prompt,
          evalId: evaluation.id,
          settings: { cacheControl: false },
        },
        options: {
          tags: ["anthropic", `eval:${evaluation.id}`],
        },
      },
    ]);

    const [openaiResult, xaiResult, anthropicResult] = result.runs;

    if (!openaiResult.ok || !xaiResult.ok || !anthropicResult.ok) {
      throw new Error("Failed to evaluate models");
    }

    if (anthropicResult.output.isCacheControl) {
      console.log("Anthropic used cache control");
    }

    console.log(`OpenAI used model: ${openaiResult.output.model}`);

    // Now send the results to the summarizer
    await summarizeEvals.trigger(
      {
        openai: openaiResult.output.text,
        xai: xaiResult.output.text,
        anthropic: anthropicResult.output.text,
      },
      {
        tags: ["summarize", `eval:${evaluation.id}`],
      }
    );
  },
});

export const summarizeEvals = schemaTask({
  id: "summarize-evals",
  description: "Summarize the evaluations",
  schema: z.object({
    openai: z.string(),
    xai: z.string(),
    anthropic: z.string(),
  }),
  run: async (payload) => {
    // Summarize the evaluations
    // Determine which one is the shortest
    // Determine which one is funniest
    // Determine which is the most informative

    // Just a dummy implementation
    return {
      openai: "Most informative",
      xai: "Shortest",
      anthropic: "Funniest",
    };
  },
});

export const evaluateOpenAI = schemaTask({
  id: "eval-openai",
  description: "Evaluate the prompt on the OpenAI API",
  schema: z.object({
    prompt: z.string(),
    evalId: z.string(),
    settings: z
      .object({
        model: z.enum(["gpt-4o", "o1-mini", "o1-preview"]).optional(),
        logprobs: z.boolean().optional(),
        user: z.string().optional(),
      })
      .optional(),
  }),
  run: async ({ prompt, evalId, settings }) => {
    const result = streamText({
      model: openai(settings?.model ?? "gpt-4o-mini", settings),
      prompt,
    });

    const fullStream = await metadata.stream("llm", result.fullStream);

    let text = "";
    let usage: number = 0;

    for await (const part of fullStream) {
      switch (part.type) {
        case "text-delta": {
          text += part.textDelta;
          break;
        }
        case "step-finish": {
          usage = part.usage.totalTokens;
          break;
        }
      }
    }

    await db.lLMResponse.create({
      data: {
        evaluationId: evalId,
        prompt: prompt,
        response: text,
        tokensUsage: usage,
        provider: "openai",
      },
    });

    return { text, model: settings?.model ?? "gpt-4o" };
  },
});

export const evaluateXAI = schemaTask({
  id: "eval-xai",
  description: "Evaluate the prompt on the XAI API",
  schema: z.object({
    prompt: z.string(),
    evalId: z.string(),
  }),
  run: async ({ prompt, evalId }) => {
    const result = streamText({
      model: xai("grok-beta"),
      prompt,
    });

    const fullStream = await metadata.stream("llm", result.fullStream);

    let text = "";
    let usage: number = 0;

    for await (const part of fullStream) {
      switch (part.type) {
        case "text-delta": {
          text += part.textDelta;
          break;
        }
        case "step-finish": {
          usage = part.usage.totalTokens;
          break;
        }
      }
    }

    await db.lLMResponse.create({
      data: {
        evaluationId: evalId,
        prompt: prompt,
        response: text,
        tokensUsage: usage,
        provider: "xai",
      },
    });

    return { text };
  },
});

export const evaluateAnthropic = schemaTask({
  id: "eval-anthropic",
  description: "Evaluate the prompt on the Anthropic API",
  schema: z.object({
    prompt: z.string(),
    evalId: z.string(),
    settings: z
      .object({
        cacheControl: z.boolean().optional(),
      })
      .optional(),
  }),
  run: async ({ prompt, evalId, settings }) => {
    const result = streamText({
      model: anthropic("claude-3-5-sonnet-20241022", {
        cacheControl:
          typeof settings?.cacheControl === "boolean"
            ? settings.cacheControl
            : false,
      }),
      prompt,
    });

    const fullStream = await metadata.stream("llm", result.fullStream);

    let text = "";
    let usage: number = 0;

    for await (const part of fullStream) {
      switch (part.type) {
        case "text-delta": {
          text += part.textDelta;
          break;
        }
        case "step-finish": {
          usage = part.usage.totalTokens;
          break;
        }
      }
    }

    await db.lLMResponse.create({
      data: {
        evaluationId: evalId,
        prompt: prompt,
        response: text,
        tokensUsage: usage,
        provider: "anthropic",
      },
    });

    return { text, isCacheControl: settings?.cacheControl ?? false };
  },
});
