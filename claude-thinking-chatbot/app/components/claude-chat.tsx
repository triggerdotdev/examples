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
import { Brain, ChevronDown, Loader2, Send } from "lucide-react";
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
  const messagesContainerRef = useRef<HTMLDivElement>(null);

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

  // Function to scroll to bottom
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  };

  // Scroll when messages update
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
      <Card className="w-full max-w-4xl min-h-[50vh] max-h-[50vh] flex flex-col">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Avatar className="size-8">
              <AvatarFallback>AI</AvatarFallback>
              <AvatarImage src="ai.png" />
            </Avatar>
            <span className="pt-1">Talk to Claude</span>
          </CardTitle>
        </CardHeader>
        {messages.length === 0 ? (
          <CardContent className="h-full flex w-full items-center justify-center flex-1">
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground gap-3">
              <img src="ai.png" className="size-8 text-black mb-2" />

              <p className="text-2xl font-bold text-black">
                How can I help you today?
              </p>
              <p className="text-sm">
                Ask me anything and I'll do my best to assist you.
              </p>
            </div>
          </CardContent>
        ) : (
          <CardContent
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {messages.map((message) => (
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
                      // Stream the response from the claude-stream task
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
            ))}
          </CardContent>
        )}

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
              placeholder="Ask AI anything..."
              className="flex-1 focus-visible:ring-black/10 focus-visible:ring-1 focus-visible:ring-offset-0"
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
  const [isThoughtExpanded, setIsThoughtExpanded] = useState(true);

  // Get a reference to the scroll container from parent component
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Function to scroll to bottom - needed in this component
  const scrollToBottom = () => {
    // Find the closest scrollable parent element
    if (messagesEndRef.current) {
      const scrollContainer =
        messagesEndRef.current.closest(".overflow-y-auto");
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  // Stream the response from the claude-stream task
  const { streams, run } = useRealtimeRunWithStreams<
    typeof claudeStream,
    STREAMS
  >(runId, { accessToken: accessToken ?? "" });

  // Filter the stream to get the display text and reasoning text
  const displayText =
    streams.claude
      ?.filter((part) => part.type === "text-delta")
      .map((part) => part.textDelta)
      .join("") ?? "";

  const reasoningText =
    streams.claude
      ?.filter((part) => part.type === "reasoning")
      .map((part) => part.textDelta)
      .join("") ?? "";

  const toggleThought = () => {
    setIsThoughtExpanded(!isThoughtExpanded);
  };

  // Scroll when displayText or reasoning text updates
  useEffect(() => {
    scrollToBottom();
  }, [displayText, reasoningText]);

  // Scroll when thought is expanded/collapsed
  useEffect(() => {
    scrollToBottom();
  }, [isThoughtExpanded]);

  return (
    <div className="flex justify-start" key={runId}>
      <div className="bg-muted rounded-lg px-4 py-2 whitespace-pre-wrap break-words w-full">
        <div className="flex flex-col gap-2">
          <button
            onClick={toggleThought}
            className="flex items-center gap-1 text-left w-full italic text-muted-foreground"
          >
            <Brain
              className={`size-4 ${!displayText ? "animate-pulse" : ""}`}
            />

            {!displayText || !reasoningText ? (
              <>
                <span className="animate-pulse">Thinking...</span>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span>Thought process</span>
                <ChevronDown
                  className={`size-4 transition-transform duration-300 ease-in-out ${
                    isThoughtExpanded ? "rotate-180" : "rotate-0"
                  }`}
                />
              </div>
            )}
          </button>

          {isThoughtExpanded && reasoningText && (
            <div className="italic text-muted-foreground ">{reasoningText}</div>
          )}

          {displayText && <div className="mt-1">{displayText}</div>}
        </div>

        {/* This invisible div serves as a marker for the end of messages */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
