import { openai } from "@ai-sdk/openai";
import { batch, task } from "@trigger.dev/sdk/v3";
import { generateText } from "ai";

// Task to generate customer response
export const generateCustomerResponse = task({
  id: "generate-customer-response",
  run: async (payload: { question: string }) => {
    const response = await generateText({
      model: openai("o1-mini"),
      messages: [
        {
          role: "system",
          content: "You are a helpful customer service representative.",
        },
        { role: "user", content: payload.question },
      ],
      experimental_telemetry: {
        isEnabled: true,
        functionId: "generate-customer-response",
      },
    });

    return response.text;
  },
});

// Task to check for inappropriate content
export const checkInappropriateContent = task({
  id: "check-inappropriate-content",
  run: async (payload: { text: string }) => {
    const response = await generateText({
      model: openai("o1-mini"),
      messages: [
        {
          role: "system",
          content:
            "You are a content moderator. Respond with 'true' if the content is inappropriate or contains harmful, threatening, offensive, or explicit content, 'false' otherwise.",
        },
        { role: "user", content: payload.text },
      ],
      experimental_telemetry: {
        isEnabled: true,
        functionId: "check-inappropriate-content",
      },
    });

    return response.text.toLowerCase().includes("true");
  },
});

// Main task that coordinates the parallel execution
export const handleCustomerQuestion = task({
  id: "handle-customer-question",
  run: async (payload: { question: string }) => {
    const {
      runs: [responseRun, moderationRun],
    } = await batch.triggerByTaskAndWait([
      {
        task: generateCustomerResponse,
        payload: { question: payload.question },
      },
      {
        task: checkInappropriateContent,
        payload: { text: payload.question },
      },
    ]);

    // Check moderation result first
    if (moderationRun.ok && moderationRun.output === true) {
      return {
        response:
          "I apologize, but I cannot process this request as it contains inappropriate content.",
        wasInappropriate: true,
      };
    }

    // Return the generated response if everything is ok
    if (responseRun.ok) {
      return {
        response: responseRun.output,
        wasInappropriate: false,
      };
    }

    // Handle any errors
    throw new Error("Failed to process customer question");
  },
});
