"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, StopCircle, Github, MessageSquare } from "lucide-react";
import { UserMessage } from "@/components/chat/user-message";
import { AiMessage } from "@/components/chat/ai-message";
import { ToolCard } from "@/components/chat/tool-card";
import { useRealtimeStream } from "@trigger.dev/react-hooks";
import { agentStream } from "@/trigger/agent-stream";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

type Message = {
  id: string;
  type: "user" | "ai" | "tool";
  content: string;
  toolName?: string;
  toolInput?: any;
  toolResult?: string;
  timestamp: Date;
};

function transformSDKMessage(sdkMsg: SDKMessage, index: number): Message | null {
  if (sdkMsg.type === 'assistant') {
    for (const block of sdkMsg.message.content) {
      if (block.type === 'text') {
        return {
          id: `ai-${index}`,
          type: 'ai',
          content: block.text,
          timestamp: new Date(),
        };
      } else if (block.type === 'tool_use') {
        return {
          id: `tool-${index}`,
          type: 'tool',
          content: '',
          toolName: block.name,
          toolInput: block.input,
          timestamp: new Date(),
        };
      }
    }
  }
  return null;
}

export default function ChatPage({ params }: { params: { runId: string } }) {
  const chatRunId = params.runId; // This is now the chat run ID
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const accessToken = searchParams.get("accessToken");
  const repoNameFromUrl = searchParams.get("repoName");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Subscribe to realtime stream from Trigger.dev (main data pipeline)
  const { parts, error: streamError } = useRealtimeStream(
    agentStream,
    chatRunId,
    {
      accessToken: accessToken ?? undefined,
      enabled: !!chatRunId && !!accessToken,
      timeoutInSeconds: 600,
      throttleInMs: 50,
    }
  );

  // Transform stream parts directly - NO useEffect
  const streamMessages = parts
    .map((msg, idx) => transformSDKMessage(msg, idx))
    .filter((msg): msg is Message => msg !== null);

  // Combine with user messages
  const allMessages = [...messages, ...streamMessages];

  // Log initial session details
  useEffect(() => {
    console.log("🚀 Chat page loaded with:", {
      chatRunId,
      sessionId,
      repoName: repoNameFromUrl,
      hasAccessToken: !!accessToken
    });
  }, []);

  // Note: Frontend doesn't need to subscribe to Supabase directly
  // All communication happens through:
  // - Questions: Frontend → /api/chat → Supabase → Backend task
  // - Responses: Backend task → Trigger.dev Stream → useRealtimeStream hook

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isRunning || !sessionId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const question = input;
    setInput("");
    setIsRunning(true);

    try {
      console.log("📤 Sending question to API:", { sessionId, question });

      // Send question via API (which uses Supabase)
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, question }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ Failed to send question:", errorData);
        throw new Error(errorData.error || "Failed to send message");
      }

      const { messageId } = await response.json();
      console.log("✅ Question sent with messageId:", messageId);

      // The response will come through the Trigger.dev stream
      // No need to update state here
    } catch (err: any) {
      setError(err.message || "Failed to send message");
      setIsRunning(false);
    }
  };

  const handleAbort = () => {
    setIsRunning(false);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="border-b px-6 py-4 flex items-center gap-3">
        <Github className="w-5 h-5" />
        <div className="flex items-center gap-2 flex-1">
          <span className="font-semibold">{repoNameFromUrl || "Repository"}</span>
          {sessionId && (
            <Badge variant="secondary" className="font-normal text-xs">
              Session: {sessionId.substring(0, 16)}...
            </Badge>
          )}
        </div>
      </header>

      <ScrollArea className="flex-1 px-6" ref={scrollRef}>
        <div className="max-w-4xl mx-auto py-6 space-y-6">
          {allMessages.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Ask a question about this repository</p>
            </div>
          ) : (
            allMessages.map((message) => {
              if (message.type === "user") {
                return <UserMessage key={message.id} content={message.content} />;
              } else if (message.type === "ai") {
                return <AiMessage key={message.id} content={message.content} />;
              } else if (message.type === "tool") {
                return (
                  <ToolCard
                    key={message.id}
                    toolName={message.toolName!}
                    toolInput={message.toolInput}
                    toolResult={message.toolResult}
                    timestamp={message.timestamp}
                  />
                );
              }
              return null;
            })
          )}

          {isRunning && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-sm">AI is thinking...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about this repository..."
              className="flex-1"
              disabled={isRunning}
            />
            {isRunning ? (
              <Button
                type="button"
                variant="destructive"
                onClick={handleAbort}
                className="gap-2"
              >
                <StopCircle className="w-4 h-4" />
                Abort
              </Button>
            ) : (
              <Button type="submit" disabled={!input.trim()} className="gap-2">
                <Send className="w-4 h-4" />
                Send
              </Button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
