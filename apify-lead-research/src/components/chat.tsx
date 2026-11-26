"use client";

import { useChat } from "@ai-sdk/react";
import { useTriggerChatTransport } from "@trigger.dev/sdk/chat/react";
import {
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import Image from "next/image";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { mintChatAccessToken, startChatSession } from "@/app/actions";
import type { researchAgent } from "@/trigger/research-agent";

const SUGGESTIONS = [
  "Write a personalized opening line for a cold email to The Miners Coffee Roastery in Prague, based on their recent Google reviews",
  "Is Light roast Coffee active on Instagram (@light_roast_business)? Followers, posting frequency and topics, to judge if they're worth contacting",
  "Find 10 specialty coffee roasteries in Pilsen with a website and phone number, for outreach",
];

type ApprovalResponse = { id: string; approved: boolean; reason?: string };

export function Chat() {
  const transport = useTriggerChatTransport<typeof researchAgent>({
    task: "research-agent",
    // A long Actor run streams nothing while the agent waits for it. The transport reconnects
    // 5 times after a timeout, so 600 seconds covers about an hour, the run-actor token timeout
    streamTimeoutSeconds: 600,
    // Only needed when the agent runs somewhere other than cloud.trigger.dev
    baseURL: process.env.NEXT_PUBLIC_TRIGGER_API_URL,
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) => startChatSession({ chatId, clientData }),
  });

  const { messages, sendMessage, addToolApprovalResponse, stop, status, error } = useChat({
    transport,
    // Sends the approval back to the agent as soon as every pending call has an answer
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  });
  const [input, setInput] = useState("");
  const busy = status === "submitted" || status === "streaming";

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-3xl flex-col">
      <header className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Image src="/apify-logo.svg" alt="Apify" width={80} height={22} priority />
          <h1 className="text-sm font-semibold">Lead research</h1>
          <span className="ml-auto text-xs text-muted">with Trigger.dev</span>
        </div>
        <p className="mt-2 text-xs text-muted">
          Ask about a lead. The agent finds an Apify Actor and asks before running it.
        </p>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
        {messages.length === 0 && (
          <div className="mt-16 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => submit(suggestion)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted hover:bg-hover hover:text-text"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {messages.map((message) => (
          <Message
            key={message.id}
            message={message}
            onApproval={addToolApprovalResponse}
            disabled={busy}
          />
        ))}

        {status === "submitted" && <p className="text-xs text-muted">Thinking…</p>}

        {error && <p className="text-xs text-warning-text">Something went wrong: {error.message}</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="flex gap-2 border-t border-border px-4 py-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about a lead…"
          className="flex-1 rounded-lg border border-field-border bg-card px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-primary"
        />
        {busy ? (
          <button
            type="button"
            onClick={() => stop()}
            className="rounded-lg bg-subtle px-3 text-sm hover:bg-hover"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-lg bg-white px-3 text-sm font-medium text-background disabled:opacity-40"
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
}

function Message({
  message,
  onApproval,
  disabled,
}: {
  message: UIMessage;
  onApproval: (response: ApprovalResponse) => void;
  disabled: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-subtle px-4 py-2 text-sm">
          {message.parts.map((part, i) => (part.type === "text" ? <span key={i}>{part.text}</span> : null))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      {message.parts.map((part, i) => {
        if (part.type === "text") {
          return (
            <div key={i} className="leading-relaxed [&_a]:text-primary-text [&_a]:underline [&_li]:ml-4 [&_ul]:list-disc">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
            </div>
          );
        }

        if (isToolUIPart(part)) {
          return <ToolCall key={i} part={part} onApproval={onApproval} disabled={disabled} />;
        }

        return null;
      })}
    </div>
  );
}

function ToolCall({
  part,
  onApproval,
  disabled,
}: {
  part: Extract<UIMessage["parts"][number], { toolCallId: string }>;
  onApproval: (response: ApprovalResponse) => void;
  disabled: boolean;
}) {
  const name = getToolName(part);

  if (part.state === "approval-requested") {
    return (
      <div className="rounded-lg border border-warning-border bg-warning-background p-3">
        <p className="text-xs font-medium text-warning-text">Run this Actor? Apify charges for it.</p>
        <pre className="mt-2 overflow-x-auto text-xs text-muted">
          {JSON.stringify(part.input, null, 2)}
        </pre>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onApproval({ id: part.approval.id, approved: true })}
            className="rounded-lg bg-primary px-3 py-1 text-xs text-white hover:bg-primary-hover disabled:opacity-40"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onApproval({ id: part.approval.id, approved: false, reason: "Denied by user" })}
            className="rounded-lg bg-subtle px-3 py-1 text-xs hover:bg-hover disabled:opacity-40"
          >
            Deny
          </button>
        </div>
      </div>
    );
  }

  const label: Record<string, string> = {
    "input-streaming": "preparing",
    "input-available": "running",
    "approval-responded": "running",
    "output-available": "done",
    "output-error": "failed",
    "output-denied": "denied",
  };

  return (
    <p className="text-xs text-muted">
      {name}: {label[part.state] ?? part.state}
    </p>
  );
}
