import { task } from "@trigger.dev/sdk";
import { AgentChat } from "@trigger.dev/sdk/chat";
import { AGENT_ID, MEETING_SESSION, type meetingAgent } from "./agent";
import { botPageUrl, recallApi } from "./services";

/**
 * Send the agent into a meeting: a Recall bot whose camera is our web page, with its live
 * transcript posted to the `recall` webhook endpoint.
 *
 * Payload: { "meetingUrl": "https://meet.google.com/abc-defg-hij" }
 */
export const joinMeeting = task({
  id: "join-meeting",
  // A retry after the bot is created would send a second bot into the meeting, so don't retry.
  retry: { maxAttempts: 1 },
  run: async ({ meetingUrl }: { meetingUrl: string }) => {
    const apiUrl = process.env.TRIGGER_API_URL ?? "https://api.trigger.dev";
    const transcriptUrl = await endpointUrl(apiUrl, "recall");
    const page = await botPageUrl("camera");

    const bot = await recallApi<{ id: string }>("/api/v1/bot/", {
      method: "POST",
      body: {
        meeting_url: meetingUrl,
        bot_name: process.env.AGENT_NAME ?? "Scout",
        recording_config: {
          transcript: {
            provider: { recallai_streaming: { mode: "prioritize_low_latency", language_code: "en" } },
          },
          realtime_endpoints: [{ type: "webhook", url: transcriptUrl, events: ["transcript.data"] }],
        },
        output_media: { camera: { kind: "webpage", config: { url: page } } },
        variant: { zoom: "web_4_core", google_meet: "web_4_core", microsoft_teams: "web_4_core" },
      },
    });

    // Start the meeting session fresh and tell it which bot it speaks through.
    const agent = new AgentChat<typeof meetingAgent>({ agent: AGENT_ID, id: MEETING_SESSION });
    const stream = await agent.sendAction({ type: "meeting.start", botId: bot.id });
    await stream.text(); // settles once onAction has run (it starts no turn)

    return { botId: bot.id };
  },
});

/** The hosted URL of one of this environment's webhook endpoints. */
async function endpointUrl(apiUrl: string, id: string) {
  const res = await fetch(`${apiUrl}/api/v1/webhooks/endpoints/${id}`, {
    headers: { Authorization: `Bearer ${process.env.TRIGGER_SECRET_KEY}` },
  });
  if (!res.ok) throw new Error(`webhook endpoint ${id}: ${res.status} ${await res.text()}`);
  const endpoint = (await res.json()) as { url: string; secretSet: boolean };
  if (!endpoint.secretSet) throw new Error(`webhook endpoint ${id} has no signing secret yet`);
  return endpoint.url;
}
