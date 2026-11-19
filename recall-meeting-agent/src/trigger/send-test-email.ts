import { task, wait } from "@trigger.dev/sdk";

/**
 * Try it out: wait, then email your inbox as the customer in the stand-in CRM, so the email
 * lands while you're talking in the meeting.
 *
 * Payload:
 * {
 *   "to": "sales@yourdomain.com",                      // your Resend inbox address
 *   "from": "Erlich Bachman <erlich@yourdomain.com>",  // any sender on a domain you've verified in Resend
 *   "delaySeconds": 60                                 // optional, defaults to 60
 * }
 */
export const sendTestEmail = task({
  id: "send-test-email",
  run: async ({ to, from, delaySeconds = 60 }: { to: string; from: string; delaySeconds?: number }) => {
    if (delaySeconds > 0) await wait.for({ seconds: delaySeconds });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "Going annual",
        text: [
          "Hi,",
          "",
          "We'll go annual, but I want 20% off and an equity stake.",
          "",
          "Erlich Bachman",
          "Pied Piper",
        ].join("\n"),
      }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    return (await res.json()) as { id: string };
  },
});
