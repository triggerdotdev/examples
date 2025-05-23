import { task } from "@trigger.dev/sdk";
import { python } from "@trigger.dev/python";

export const outputGuardrailsTask = task({
  id: "output-guardrails",
  run: async (payload: { prompt: string }) => {
    const result = await python.runScript(
      "./src/python/output-guardrails.py",
      [payload.prompt],
    );

    // The Python script will return JSON with response and whether the guardrail was triggered
    const parsedResponse = JSON.parse(result.stdout.trim());

    return {
      mathBotResponse: parsedResponse.math_analysis,
      response: parsedResponse.response,
      guardrailTriggered: parsedResponse.guardrail_triggered,
    };
  },
});
