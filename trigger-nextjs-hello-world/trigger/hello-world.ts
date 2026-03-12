import { logger, task, wait } from "@trigger.dev/sdk";

export const helloWorldTask = task({
  id: "hello-world",
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: { message: string }) => {
    logger.info("Hello world task started", { payload });

    await wait.for({ seconds: 1 });

    const message = `${payload.message} — completed at ${
      new Date().toISOString()
    }`;

    logger.info("Hello world task completed", { message });

    return { message };
  },
});
