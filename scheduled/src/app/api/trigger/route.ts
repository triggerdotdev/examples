import { createAppRoute } from "@trigger.dev/nextjs";
import { client } from "@/trigger";

// Replace this with your own jobs
import "@/jobs/interval";
import "@/jobs/cronScheduled";

//this route is used to send and receive data with Trigger.dev
export const { POST, dynamic } = createAppRoute(client);
