import { schedules } from "@trigger.dev/sdk";
import Anchorbrowser from 'anchorbrowser';

export const broadwayMonitor = schedules.task({
  id: "broadway-ticket-monitor",
  cron: "0 21 * * *",
  run: async (payload, { ctx }) => {
    const client = new Anchorbrowser({
      apiKey: process.env.ANCHOR_BROWSER_API_KEY!,
    });

    let session;
    try {
      // Create explicit session to get live view URL
      session = await client.sessions.create();
      console.log(`Session ID: ${session.data.id}`);
      console.log(`Live View URL: https://live.anchorbrowser.io?sessionId=${session.data.id}`);

      const response = await client.tools.performWebTask({
        sessionId: session.data.id,
        url: "https://www.tdf.org/discount-ticket-programs/tkts-by-tdf/tkts-live/",
        prompt: `Look for the "Broadway Shows" section on this page. Find the show with the absolute lowest starting price available right now and return the show name, current lowest price, and show time. Be very specific about the current price you see. Format as: Show: [name], Price: [exact current price], Time: [time]`
      });

      console.log("Raw response:", response);
      
      const result = response.data.result?.result || response.data.result || response.data;
      
      if (result && typeof result === 'string' && result.includes('Show:')) {
        console.log(`🎭 Best Broadway Deal Found!`);
        console.log(result);

        return {
          success: true,
          bestDeal: result,
          liveViewUrl: `https://live.anchorbrowser.io?sessionId=${session.data.id}`
        };
      } else {
        console.log("No Broadway deals found today");
        return { success: true, message: "No deals found" };
      }

    } finally {
      if (session?.data?.id) {
        try {
          await client.sessions.delete(session.data.id);
        } catch (cleanupError) {
          console.warn("Failed to cleanup session:", cleanupError);
        }
      }
    }
  },
});
