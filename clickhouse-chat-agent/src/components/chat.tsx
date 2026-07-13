"use client";

import { useChat } from "@ai-sdk/react";
import { useTriggerChatTransport } from "@trigger.dev/sdk/chat/react";
import type { UIMessage } from "ai";
import { ArrowUp, Database, Loader2, Square } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { mintChatAccessToken, startChatSession } from "@/app/actions";
import { normalizeSpec } from "@/lib/catalog";
import { Visualization } from "@/components/visualization";
import type { clickhouseAgent } from "@/trigger/clickhouse-agent";

const SUGGESTIONS = [
  "Give me a dashboard of the taxi data: daily trip volume over time, demand by hour of day, and revenue share by payment type",
  "Where do trips start and end? Show pickup and dropoff hotspots on two maps, sized by trip count",
  "What data do I have?",
  "Break down trips by payment type",
];

export function Chat() {
  const transport = useTriggerChatTransport<typeof clickhouseAgent>({
    task: "clickhouse-agent",
    // Only needed when the agent runs somewhere other than cloud.trigger.dev
    // (e.g. self-hosted) — the server-side TRIGGER_API_URL isn't visible in
    // the browser, so the SSE endpoints get their base URL from this.
    baseURL: process.env.NEXT_PUBLIC_TRIGGER_API_URL,
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) => startChatSession({ chatId, clientData }),
  });

  const { messages, sendMessage, stop, status } = useChat({ transport });
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
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <Database className="size-4 text-muted-foreground" />
        <h1 className="text-sm font-semibold">ClickHouse chat agent</h1>
        <span className="ml-auto text-xs text-muted-foreground">
          Charts &amp; tables, not walls of text
        </span>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-secondary">
        {messages.length === 0 && (
          <div className="mt-16 space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Ask about the data in your ClickHouse database.
            </p>
            <div className="mx-auto flex max-w-md flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <Message key={message.id} message={message} />
        ))}

        {status === "submitted" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Thinking…
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="border-t px-4 py-3"
      >
        <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 focus-within:ring-2 focus-within:ring-ring/50">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your data…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => stop()}
              className="rounded-lg bg-secondary p-2 text-secondary-foreground transition-colors hover:bg-secondary/80"
              aria-label="Stop"
            >
              <Square className="size-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded-lg bg-primary p-2 text-primary-foreground transition-colors disabled:opacity-40"
              aria-label="Send"
            >
              <ArrowUp className="size-3.5" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function Message({ message }: { message: UIMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">
          {message.parts.map((part, i) => (part.type === "text" ? <span key={i}>{part.text}</span> : null))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1 text-sm">
      {message.parts.map((part, i) => (
        <MessagePart key={i} part={part} />
      ))}
    </div>
  );
}

function MessagePart({ part }: { part: UIMessage["parts"][number] }) {
  if (part.type === "text") {
    return (
      <div className="prose-sm max-w-none leading-relaxed [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
      </div>
    );
  }

  if (part.type === "tool-renderVisualization") {
    const input = part.input as { spec?: unknown } | undefined;
    const output = part.output as { ok?: boolean } | undefined;
    const spec = part.state === "input-streaming" ? null : normalizeSpec(input?.spec);

    // Wait for the full spec before rendering; if validation failed the
    // agent fixes the spec and calls the tool again.
    if (!spec) {
      return <ToolStatus label="Building visualization…" spinning />;
    }
    if (output && output.ok === false) {
      return <ToolStatus label="Refining visualization…" spinning />;
    }
    return <Visualization spec={spec} />;
  }

  if (part.type === "tool-listTables") {
    return <ToolStatus label="Listing tables" spinning={part.state !== "output-available"} />;
  }

  if (part.type === "tool-describeTable") {
    const input = part.input as { table?: string } | undefined;
    return (
      <ToolStatus
        label={`Reading schema${input?.table ? ` of ${input.table}` : ""}`}
        spinning={part.state !== "output-available"}
      />
    );
  }

  if (part.type === "tool-runQuery") {
    const input = part.input as { query?: string } | undefined;
    return (
      <details className="group my-1">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs text-muted-foreground">
          {part.state !== "output-available" ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Database className="size-3" />
          )}
          Ran a query
          <span className="opacity-60 group-open:hidden">— click to expand</span>
        </summary>
        {input?.query && (
          <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs scrollbar-thin scrollbar-track-transparent scrollbar-thumb-secondary">
            {input.query}
          </pre>
        )}
      </details>
    );
  }

  return null;
}

function ToolStatus({ label, spinning }: { label: string; spinning?: boolean }) {
  return (
    <div className="my-1 flex items-center gap-1.5 text-xs text-muted-foreground">
      {spinning ? <Loader2 className="size-3 animate-spin" /> : <Database className="size-3" />}
      {label}
    </div>
  );
}
