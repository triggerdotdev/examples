"use client";

import { AiMessage } from "@/components/chat/ai-message";
import { ToolCard } from "@/components/chat/tool-card";
import { UserMessage } from "@/components/chat/user-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import { agentStream } from "@/trigger/agent-stream";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { RealtimeChannel } from "@supabase/supabase-js";
import { useRealtimeStream } from "@trigger.dev/react-hooks";
import { Github, MessageSquare, Send, StopCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  type: "user" | "ai" | "tool";
  content: string;
  toolName?: string;
  toolInput?: any;
  toolResult?: string;
  timestamp: Date;
};

function transformSDKMessage(
  sdkMsg: SDKMessage,
  index: number
): Message | null {
  if (sdkMsg.type === "assistant") {
    for (const block of sdkMsg.message.content) {
      if (block.type === "text") {
        return {
          id: `ai-${index}`,
          type: "ai",
          content: block.text,
          timestamp: new Date(),
        };
      } else if (block.type === "tool_use") {
        return {
          id: `tool-${index}`,
          type: "tool",
          content: "",
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
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Subscribe to realtime stream from Trigger.dev (main data pipeline)
  const { parts, error: streamError } = useRealtimeStream(
    agentStream,
    chatRunId,
    {
      accessToken: accessToken ?? undefined,
      enabled: !!chatRunId && !!accessToken,
      timeoutInSeconds: 600,
      throttleInMs: 50,
      onData: (chunk) => {
        console.log("the chunk should be: ", chunk);
      },
    }
  );

  // Transform stream parts directly - NO useEffect
  const streamMessages = parts
    .map((msg, idx) => transformSDKMessage(msg, idx))
    .filter((msg): msg is Message => msg !== null);

  // Combine with user messages
  const allMessages = [...messages, ...streamMessages];

  // Initialize Supabase broadcast channel
  useEffect(() => {
    if (!sessionId) {
      console.log("[Chat] No sessionId, skipping channel setup");
      return;
    }

    console.log("[Chat] Setting up Supabase channel for sessionId:", sessionId);

    const channelName = `session:${sessionId}`;

    // Create channel for broadcasting questions
    // NOTE: Clean up console.logs after debugging
    const channel = supabase.channel(channelName, {
      config: {
        private: false, // Use private channel with RLS
        broadcast: {
          self: false,
          ack: true,
        },
      },
    });

    channel
      .on("broadcast", { event: "question" }, (payload) => {
        console.log(`[Chat] Channel received question: ${payload}`);
      })
      .subscribe();

    // Store the channel reference so we can use it to send messages
    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      console.log("[Chat] Cleaning up channel subscription");
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [sessionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isRunning || !sessionId || !channelRef.current) {
      console.log("[Chat] Cannot send:", {
        hasInput: !!input.trim(),
        isRunning,
        hasSessionId: !!sessionId,
        hasChannel: !!channelRef.current,
      });
      return;
    }

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
      console.log("[Chat] 📤 Broadcasting question:", { sessionId, question });

      // Send question directly via Supabase broadcast
      // NOTE: Clean up console.logs after debugging
      const result = await supabase.channel(`session:${sessionId}`).send({
        type: "broadcast",
        event: "question",
        payload: {
          question: question,
          timestamp: new Date().toISOString(),
          messageId: userMessage.id,
        },
      });
      console.log("[Chat] result: ", result);

      if (result === "ok") {
        console.log("[Chat] ✅ Question broadcast successfully");
        // The response will come through the Trigger.dev stream
      } else {
        console.error("[Chat] ❌ Failed to broadcast question:", result);
        throw new Error("Failed to send message");
      }
    } catch (err: any) {
      console.error("[Chat] Error sending message:", err);
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
          <span className="font-semibold">
            {repoNameFromUrl || "Repository"}
          </span>
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
                return (
                  <UserMessage key={message.id} content={message.content} />
                );
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
                <div
                  className="w-2 h-2 bg-current rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <div
                  className="w-2 h-2 bg-current rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <div
                  className="w-2 h-2 bg-current rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
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
