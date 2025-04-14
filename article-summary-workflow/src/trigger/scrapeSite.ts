import { logger, task } from "@trigger.dev/sdk";
import { htmlToText } from "html-to-text";

export const scrape = task({
  id: "scrape-site",
  maxDuration: 300,
  run: async (payload: { url: string }) => {
    const response = await fetch(payload.url);
    const html = await response.text();

    // Very basic way to extract the content.
    // You might want to use tools like https://www.firecrawl.dev/ for a more robust solution.
    const content = htmlToText(html);

    logger.info("Site scraped successfully", { url: payload.url });

    return {
      content,
    };
  },
});
