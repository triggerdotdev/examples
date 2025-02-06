import { openai } from "@ai-sdk/openai";
import { task } from "@trigger.dev/sdk/v3";
import { generateText } from "ai";

export interface TranslatePayload {
  marketingSubject: string;
  targetLanguage: string;
  targetWordCount: number;
}

export const generateAndTranslateTask = task({
  id: "generate-and-translate-copy",
  maxDuration: 300, // Stop executing after 5 mins of compute
  run: async (payload: TranslatePayload) => {
    // Step 1: Generate marketing copy
    const generatedCopy = await generateText({
      model: openai("o1-mini"),
      messages: [
        {
          role: "system",
          content: "You are an expert copywriter.",
        },
        {
          role: "user",
          content: `Generate as close as possible to ${payload.targetWordCount} words of compelling marketing copy for ${payload.marketingSubject}`,
        },
      ],
      experimental_telemetry: {
        isEnabled: true,
        functionId: "generate-and-translate-copy",
      },
    });

    // Gate: Validate the generated copy meets the word count target
    const wordCount = generatedCopy.text.split(/\s+/).length;

    if (
      wordCount < payload.targetWordCount - 10 ||
      wordCount > payload.targetWordCount + 10
    ) {
      throw new Error(
        `Generated copy length (${wordCount} words) is outside acceptable range of ${
          payload.targetWordCount - 10
        }-${payload.targetWordCount + 10} words`
      );
    }

    // Step 2: Translate to target language
    const translatedCopy = await generateText({
      model: openai("o1-mini"),
      messages: [
        {
          role: "system",
          content: `You are an expert translator specializing in marketing content translation into ${payload.targetLanguage}.`,
        },
        {
          role: "user",
          content: `Translate the following marketing copy to ${payload.targetLanguage}, maintaining the same tone and marketing impact:\n\n${generatedCopy}`,
        },
      ],
      experimental_telemetry: {
        isEnabled: true,
        functionId: "generate-and-translate-copy",
      },
    });

    return {
      englishCopy: generatedCopy,
      translatedCopy,
    };
  },
});
