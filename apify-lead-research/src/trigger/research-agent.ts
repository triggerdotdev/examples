import { chat } from "@trigger.dev/sdk/ai";
import { stepCountIs } from "ai";
import { getApifyActorInputSchema, runApifyActor, searchApifyActors } from "./apify-tools";
import { model } from "./model";

const tools = { searchApifyActors, getApifyActorInputSchema, runApifyActor };

export const researchAgent = chat.agent({
  id: "research-agent",
  tools,
  system:
    "You help a sales team research leads. When a question needs fresh data from " +
    "the web, such as recent reviews or a social media profile, search Apify " +
    "Store for a suitable Actor, read its input schema, then run it. Never invent " +
    "IDs or URLs: prefer inputs that take a search term, such as a business name " +
    "and city. Keep runs small: limit results to what the question needs. Answer " +
    "concisely and cite where the data came from.",
  run: async ({ messages, tools, signal, streamText }) =>
    streamText({
      tools,
      model,
      messages,
      abortSignal: signal,
      stopWhen: stepCountIs(15),
    }),
});
