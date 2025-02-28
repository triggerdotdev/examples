"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import type { claudeStream, STREAMS } from "@/src/trigger/claude-stream";
import { useRealtimeRunWithStreams } from "@trigger.dev/react-hooks";
import { Loader2, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { streamWithClaude } from "../actions";

type Message = {
  id: string;
  role: "user" | "assistant";
  prompt: string;
  runId?: string;
  accessToken?: string;
};

export function ClaudeChat() {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim()) return;

    setIsLoading(true);

    try {
      // Add user message
      const userMessage: Message = {
        id: input,
        role: "user",
        prompt: input,
      };
      setInput("");
      const { run } = await streamWithClaude(userMessage.prompt);
      const assistantMessage: Message = {
        id: run.id,
        role: "assistant",
        prompt: "Thinking...",
        runId: run.id,
        accessToken: run.publicAccessToken,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsLoading(false);
    } catch (error) {
      console.error("Error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send message. Please try again.",
      });
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (inputRef.current && !isLoading) {
      inputRef.current.focus();
    }
  }, [isLoading]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
      <Card className="w-full max-w-4xl max-h-9xl flex flex-col">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Avatar>
              <AvatarFallback>AI</AvatarFallback>
              <AvatarImage src="ai.png" />
            </Avatar>
            Talk to Claude
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground gap-3">
              <img src="ai.png" className="size-8 text-black mb-2" />

              <p className="text-2xl font-bold text-black">
                How can I help you today?
              </p>
              <p className="text-sm">
                Ask me anything and I'll do my best to assist you.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div className="flex items-start gap-3 max-w-[80%]">
                  {message.role === "assistant" && (
                    <Avatar className="mt-0.5 border">
                      <AvatarFallback>AI</AvatarFallback>
                      <AvatarImage src="ai.png" />
                    </Avatar>
                  )}

                  <div
                    className={`rounded-lg px-4 py-2 ${
                      message.role === "user"
                        ? "bg-black text-white"
                        : "bg-muted"
                    }`}
                  >
                    {message.role === "assistant" && message.accessToken ? (
                      <StreamResponse
                        runId={message.runId}
                        accessToken={message.accessToken}
                      />
                    ) : (
                      message.prompt
                    )}
                  </div>

                  {message.role === "user" && (
                    <Avatar className="mt-0.5 border bg-black">
                      <AvatarFallback className="text-white" />
                      <AvatarImage src="/user.png" />
                    </Avatar>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>

        <CardFooter className="border-t p-4">
          <form onSubmit={handleSubmit} className="flex w-full gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim() && !isLoading) {
                    handleSubmit(e);
                  }
                }
              }}
              placeholder="Type your message..."
              className="flex-1 focus-visible:ring-black focus-visible:ring-offset-2"
              disabled={isLoading}
            />

            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-black hover:bg-black/90 transition-colors"
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              <span className="sr-only">Send message</span>
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}

interface StreamResponseProps {
  runId: string | undefined;
  accessToken: string | null;
}

function StreamResponse({ runId, accessToken }: StreamResponseProps) {
  const { streams, run } = useRealtimeRunWithStreams<
    typeof claudeStream,
    STREAMS
  >(runId, { accessToken: accessToken ?? "" });

  const displayText =
    streams.claude
      ?.filter((part) => part.type === "text-delta")
      .map((part) => part.textDelta)
      .join("") ?? "";
  const reasoning =
    streams.claude
      ?.filter((part) => part.type === "reasoning")
      .map((part) => part.textDelta)
      .join("") ?? "";

  return (
    <div className="flex justify-start" key={runId}>
      <div className="flex items-start gap-3 max-w-[80%]">
        <div className="bg-muted rounded-lg px-4 py-2 whitespace-pre-wrap break-words">
          <div className="flex flex-col gap-2">
            <span className="italic text-muted-foreground">
              {reasoning ? reasoning : "Thinking..."}
            </span>
            {displayText && <span>{displayText}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
