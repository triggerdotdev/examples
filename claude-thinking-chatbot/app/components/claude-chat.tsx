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
import { Loader2, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { claudeStream, STREAMS } from "@/src/trigger/claude-stream";
import {
  useRealtimeRun,
  useRealtimeRunWithStreams,
  useRun,
} from "@trigger.dev/react-hooks";
import { streamWithClaude } from "../actions";

// Define a message type
type Message = {
  id: string;
  role: "user" | "assistant";
  prompt: string;
};

export function ClaudeChat({
  runId,
  accessToken,
}: {
  runId: string;
  accessToken: string;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentRunId, setCurrentRunId] = useState<string>(runId);
  const [currentAccessToken, setCurrentAccessToken] =
    useState<string>(accessToken);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      prompt: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Clear input
    setInput("");

    try {
      const { run, publicAccessToken } = await streamWithClaude(
        userMessage.prompt
      );
      setCurrentRunId(run.id);
      setCurrentAccessToken(publicAccessToken);
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

  // Use the current run ID and access token for real-time updates
  const { run, error } = useRealtimeRun(currentRunId, {
    accessToken: currentAccessToken,
    onComplete: (run, error) => {
      setIsLoading(false);
    },
  });

  // Add the initial message when the component mounts
  useEffect(() => {
    // We'll add the initial user message when the component first mounts
    const initialUserMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      prompt: "Hello, Claude!", // This is a placeholder, we don't know the actual first message
    };
    setMessages([initialUserMessage]);
  }, []);

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
            <div className="size-8 rounded-full bg-black flex items-center justify-center">
              <span className="text-white text-sm font-semibold">AI</span>
            </div>
            Talk to Claude
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div className="flex items-start gap-3 max-w-[80%]">
                {message.role !== "user" && (
                  <Avatar className="mt-0.5 border">
                    <AvatarFallback>AI</AvatarFallback>
                    <AvatarImage src="/user.png" />
                  </Avatar>
                )}

                <div
                  className={`rounded-lg px-4 py-2 ${
                    message.role === "user" ? "bg-black text-white" : "bg-muted"
                  }`}
                >
                  {message.prompt}
                </div>

                {message.role === "user" && (
                  <Avatar className="mt-0.5 border bg-black">
                    <AvatarFallback className="text-white" />
                    <AvatarImage src="/user.png" />{" "}
                  </Avatar>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <StreamResponse
              runId={currentRunId}
              accessToken={currentAccessToken}
              onComplete={(text) => {
                // Add assistant message when stream completes
                const assistantMessage: Message = {
                  id: Date.now().toString(),
                  role: "assistant",
                  prompt: text,
                };
                setMessages((prev) => [...prev, assistantMessage]);
              }}
            />
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
  runId: string;
  accessToken: string;
  onComplete: (text: string) => void;
}

export function StreamResponse({
  runId,
  accessToken,
  onComplete,
}: StreamResponseProps) {
  const hasCalledCompleteRef = useRef(false);

  const { streams, run } = useRealtimeRunWithStreams<
    typeof claudeStream,
    STREAMS
  >(runId, { accessToken });

  // Debug what's coming in
  useEffect(() => {
    console.log("Streams:", streams);
  }, [streams]);

  // Check if the run has completed and notify parent
  useEffect(() => {
    if (
      run?.status === "COMPLETED" &&
      !hasCalledCompleteRef.current &&
      streams?.text
    ) {
      hasCalledCompleteRef.current = true;
      const responseText = Array.isArray(streams.text)
        ? streams.text.join("")
        : streams.text;
      onComplete(responseText);
    }
  }, [run?.status, streams?.text, onComplete]);

  const displayText = streams?.text ?? "";
  const reasoning = streams?.reasoning ?? "";

  return (
    <div className="flex justify-start">
      <div className="flex items-start gap-3 max-w-[80%]">
        <Avatar className="mt-0.5 border">
          <AvatarFallback className="bg-black text-white">AI</AvatarFallback>
          <AvatarImage src="" />
        </Avatar>

        <div className="bg-muted rounded-lg px-4 py-2 whitespace-pre-wrap break-words">
          {reasoning && displayText ? (
            <div className="flex flex-col gap-2">
              <span className="italic text-muted-foreground">{reasoning}</span>
              <span> {displayText}</span>
            </div>
          ) : (
            "Thinking..."
          )}
        </div>
      </div>
    </div>
  );
}
