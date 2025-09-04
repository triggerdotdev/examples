### Project Setup

This example demonstrates automated web monitoring using Trigger.dev's job scheduling and Anchor Browser's AI-powered browser automation tools. The project runs daily at 5pm ET to find the cheapest Broadway tickets available for same-day shows.

##### How it works:

1. Trigger.dev schedules and executes the monitoring job
2. Anchor Browser spins up a remote browser session with an AI agent
3. The AI agent uses computer vision and natural language processing to analyze the [TDF website](https://www.tdf.org/discount-ticket-programs/tkts-by-tdf/tkts-live/)
4. AI agent returns the lowest-priced show with specific details: name, price, and showtime


#### Prerequisites

Before we dive into the code, you'll need:
- Node.js (version 16 or higher) 
- A Trigger.dev account - Sign up at https://trigger.dev for their free tier
- Anchor Browser API access - Get your API key from the [Anchor Browser dashboard](https://anchorbrowser.io)

#### Dependencies installation

Initialize a new Node.js project and install the required packages from Anchor Browser and Trigger.dev:

```
npm init -y
npm install anchorbrowser
npx trigger.dev@latest init -p <project id from trigger.dev>
```

#### Environment configuration

Create a .env file in your project root with the following variables:

```
# Trigger.dev Configuration 
TRIGGER_API_KEY=tr_dev_your_trigger_api_key_here 

# Anchor Browser Configuration 
ANCHOR_BROWSER_API_KEY=sk-your_anchor_browser_api_key_here
```

Make sure to add .env to your .gitignore file to keep your API keys secure:

```
echo ".env" >> .gitignore
```

Since Anchor Browser uses browser automation libraries under the hood, we need to configure Trigger.dev to handle these dependencies properly by excluding them from the build bundle.

Configure Trigger.dev's trigger.config.ts for browser automation dependencies:

```
import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_your_project_id_here", // Get from Trigger.dev dashboard
  maxDuration: 3600, // 1 hour - plenty of time for web automation
  dirs: ["./src/trigger"],
  build: {
    external: [
      "playwright-core",
      "playwright", 
      "chromium-bidi"
    ]
  }
});
```

### Core Monitoring Job

Create a new file within your project subfolder for trigger.dev functions, [src/trigger/broadway-monitor.ts](src/trigger/broadway-monitor.ts). Below is our Broadway ticket monitor task that runs daily at 5pm ET:


```
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
```

Run the Trigger.dev development server from your project root directory to register your new task:

```
npx trigger.dev@latest dev
```

### Learn more
- [Trigger.dev docs](https://trigger.dev/docs) - learn about Trigger.dev
- [Anchor Browser docs](https://docs.anchorbrowser.io/introduction) - learn about Anchor Browser
