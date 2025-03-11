import { logger, schemaTask, task } from "@trigger.dev/sdk/v3";
import { python } from "@trigger.dev/python";
import { z } from "zod";

export const convertUrlToMarkdown = schemaTask({
  id: "convert-url-to-markdown",
  schema: z.object({
    url: z.string().url(),
  }),
  run: async (payload) => {
    // Pass through any proxy environment variables from the Trigger.dev environment
    const env = {
      PROXY_URL: process.env.PROXY_URL,
      PROXY_USERNAME: process.env.PROXY_USERNAME,
      PROXY_PASSWORD: process.env.PROXY_PASSWORD,
    };

    const result = await python.runScript("./src/python/crawl-url.py", [
      payload.url,
    ], { env });

    logger.debug("convert-url-to-markdown", {
      url: payload.url,
      result,
    });

    return result.stdout;
  },
});
