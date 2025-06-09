import { schemaTask } from "@trigger.dev/sdk/v3";
import { generateObject } from "ai";
import z from "zod";
import { mainLLM } from "./deepResearch";

export const generateLearnings = schemaTask({
  id: "generate-learnings",
  schema: z.object({
    query: z.string().min(1),
    searchResult: z.object({
      title: z.string(),
      url: z.string().url(),
      content: z.string(),
    }),
  }),
  run: async (payload) => {
    const { object } = await generateObject({
      model: mainLLM,
      prompt:
        `The user is researching "${payload.query}". The following search result were deemed relevant.
    Generate a learning and a follow-up question from the following search result:
 
    <search_result>
    ${JSON.stringify(payload.searchResult)}
    </search_result>
    `,
      schema: z.object({
        learning: z.string(),
        followUpQuestions: z.array(z.string()),
      }),
    });
    return object;
  },
});
