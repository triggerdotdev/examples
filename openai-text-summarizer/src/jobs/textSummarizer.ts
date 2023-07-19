import { Job, eventTrigger } from "@trigger.dev/sdk";
import { client } from "@/trigger";
import { OpenAI } from "@trigger.dev/openai";
import { z } from "zod";

const openai = new OpenAI({
  id: "openai",
  apiKey: process.env.OPENAI_API_KEY!,
});

// text summarizer job
new Job(client, {
  id: "openai-summarizer",
  name: "OpenAI – Text Summarizer",
  version: "0.0.1",
  trigger: eventTrigger({
    name: "openai.summarizer",
    schema: z.object({
      textPrompt: z.string(),
    }),
  }),
  integrations: {
    openai,
  },
  run: async (payload, io, ctx) => {
    await io.openai.retrieveModel("get-model", {
      model: "gpt-3.5-turbo",
    });

    const models = await io.openai.listModels("list-models");

    await io.openai.backgroundCreateChatCompletion(
      "background-chat-completion",
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: payload.textPrompt,
          },
        ],
      }
    );
  },
});
