import { webhooks } from "@trigger.dev/sdk";

// Resend Inbox: a new email in your team inbox (inbox.email.received).
export type InboxEvent = {
  type: string;
  created_at: string;
  data: {
    inbox_id: string;
    thread_id: string;
    email_id: string;
    email?: {
      id: string;
      direction: "inbound" | "outbound";
      from: string;
      to: string[];
      subject: string | null;
    };
  };
};

// Recall.ai real-time endpoint: one finished utterance from the meeting (transcript.data).
export type RecallEvent = {
  event: string;
  data: {
    data: {
      words: { text: string }[];
      participant: { id: number; name: string | null; is_host: boolean | null };
    };
    bot: { id: string; metadata: Record<string, unknown> };
  };
};

export const inbox = webhooks.endpoint.define({
  id: "inbox",
  source: webhooks.resend<InboxEvent>(),
});

export const recall = webhooks.endpoint.define({
  id: "recall",
  source: webhooks.recallai<RecallEvent>(),
});
