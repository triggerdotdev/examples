import { openai } from "@ai-sdk/openai";
import { task } from "@trigger.dev/sdk/v3";
import { generateText } from "ai";
import { z } from "zod";

// Schema for router response
const routingSchema = z.object({
  model: z.enum(["gpt-4o", "gpt-o3-mini"]),
  reason: z.string(),
});

// Router prompt template
const ROUTER_PROMPT = `You are a routing assistant that determines the complexity of questions.
Analyze the following question and route it to the appropriate model:

- Use "gpt-4o" for simple, common, or straightforward questions
- Use "gpt-o3-mini" for complex, unusual, or questions requiring deep reasoning

Respond with a JSON object in this exact format:
{"model": "gpt-4o" or "gpt-o3-mini", "reason": "your reasoning here"}

Question: `;

export const routeAndAnswerQuestion = task({
  id: "route-and-answer-question",
  run: async (payload: { question: string }) => {
    // Step 1: Route the question
    const routingResponse = await generateText({
      model: openai("o1-mini"),
      messages: [
        {
          role: "system",
          content:
            "You must respond with a valid JSON object containing only 'model' and 'reason' fields. No markdown, no backticks, no explanation.",
        },
        {
          role: "user",
          content: ROUTER_PROMPT + payload.question,
        },
      ],
      temperature: 0.1,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "route-and-answer-question",
      },
    });

    // Add error handling and cleanup
    let jsonText = routingResponse.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```json\n|\n```/g, "");
    }

    const routingResult = routingSchema.parse(JSON.parse(jsonText));

    // Step 2: Get the answer using the selected model
    const answerResult = await generateText({
      model: openai(routingResult.model),
      messages: [{ role: "user", content: payload.question }],
    });

    return {
      answer: answerResult.text,
      selectedModel: routingResult.model,
      routingReason: routingResult.reason,
    };
  },
});
