import { client } from "../../../trigger.js";

export const post = async () => {
  await client.sendEvent({
    name: "astro.event",
    payload: { name: "John Doe", email: "john@doe.com", paidPlan: true },
  });

  return new Response(JSON.stringify({ message: "Queued event!" }), {
    status: 200,
  });
};
