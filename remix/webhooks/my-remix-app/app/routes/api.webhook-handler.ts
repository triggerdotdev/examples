import type { ActionFunctionArgs } from "@remix-run/node";
import { tasks } from "@trigger.dev/sdk/v3";
import { helloWorldTask } from "src/trigger/example";

// This function can handle GET requests to check if the webhook is active in the browser - not required for Trigger but helpful for testing
export async function loader() {
  return new Response("Webhook endpoint is active", { status: 200 });
}

// This function handles the actual webhook payload and triggers the helloWorldTask
export async function action({ request }: ActionFunctionArgs) {
  const payload = await request.json();
  console.log("Received webhook payload:", payload);

  // Trigger the helloWorldTask with the webhook data as the payload
  await tasks.trigger<typeof helloWorldTask>("hello-world", payload);

  return new Response("OK", { status: 200 });
}
