import { logger, task } from "@trigger.dev/sdk";
import { python } from "@trigger.dev/python";

// This task takes a prompt and character check interval
// Example: { "prompt": "What is a black hole?", "characterCheckInterval": 200 }
export const streamingGuardrailsTask = task({
  id: "streaming-guardrails",
  run: async (payload: { prompt: string; characterCheckInterval?: number }) => {
    const checkInterval = payload.characterCheckInterval || 30;

    const result = python.stream.runScript(
      "./src/python/streaming-guardrails.py",
      [payload.prompt, checkInterval.toString()],
    );

    let output = "";

    for await (const chunk of result) {
      logger.info(chunk);
      output = chunk;
    }

    // The Python script streams the response to stdout in real-time, then returns JSON with full response text and guardrail metrics
    const parsedResponse = JSON.parse(output.trim());

    return {
      response: parsedResponse.response,
      guardrailTriggered: parsedResponse.guardrail_triggered,
      guardrailReason: parsedResponse.guardrail_reason,
      guardrailTriggeredAt: parsedResponse.guardrail_triggered_at,
      guardrailEvaluatedTextLength:
        parsedResponse.guardrail_evaluated_text_length,
      charactersCheckedAtInterval:
        parsedResponse.characters_checked_at_interval,
      totalCharacters: parsedResponse.total_characters,
    };
  },
});
