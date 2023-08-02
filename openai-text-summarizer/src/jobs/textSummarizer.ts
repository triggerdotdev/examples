import { client } from "@/trigger";
import { OpenAI } from "@trigger.dev/openai";
import { eventTrigger } from "@trigger.dev/sdk";
import { Slack } from "@trigger.dev/slack";
import { z } from "zod";

const openai = new OpenAI({
  id: "openai",
  apiKey: process.env.OPENAI_API_KEY!,
});

const slack = new Slack({
  id: "slack-2",
});

// use Open AI to summarize text from the form
client.defineJob({
  id: "openai-summarizer",
  name: "OpenAI – Text Summarizer",
  version: "0.0.1",
  trigger: eventTrigger({
    name: "summarize.text",
    schema: z.object({
      text: z.string(),
    }),
  }),
  integrations: {
    openai,
    slack,
  },
  run: async (payload, io) => {
    // If you want to summarize really long text, you should use a different model that has a higher token limit.
    const result = await io.openai.backgroundCreateChatCompletion(
      "Generating summary",
      {
        model: "gpt-3.5-turbo-16k",
        messages: [
          {
            role: "user",
            content: `Summarize the following text with the most unique and helpful points, into a numbered list of key points and takeaways: \n ${payload.text}`,
          },
        ],
      }
    );

    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      io.logger.error(
        "Failed to post your message to Slack. The content is undefined."
      );
      return;
    }

    const summary = result.choices[0].message.content;

    await io.slack.postMessage("Posting to Slack", {
      // replace this with your own channel ID
      channel: "C05HNRBV22H",
      text: summary,
    });

    return {
      summary,
    };
  },
});
