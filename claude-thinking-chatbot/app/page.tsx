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
import { streamWithClaude } from "./actions";
import { StreamResponse } from "./components/stream-response";

// Define a message type
type Message = {
  id: string;
  role: "user" | "assistant";
  prompt: string;
};

export default function ChatPage() {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

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
      setAccessToken(publicAccessToken);
      setRunId(run.id);
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
            <div className="size-8 rounded-full bg-black flex items-center justify-center">
              <span className="text-white text-sm font-semibold">AI</span>
            </div>
            Talk to Claude
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
              <div className="size-12 rounded-full bg-black/10 flex items-center justify-center mb-4">
                <Send className="size-6 text-black" />
              </div>
              <p className="text-lg font-medium">How can I help you today?</p>
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
                  {message.role !== "user" && (
                    <Avatar className="mt-0.5 border">
                      <AvatarFallback>AI</AvatarFallback>
                      <AvatarImage src="/user.png" />
                    </Avatar>
                  )}

                  <div
                    className={`rounded-lg px-4 py-2 ${
                      message.role === "user"
                        ? "bg-black text-white"
                        : "bg-muted"
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
            ))
          )}

          {isLoading && (
            <>
              {runId && accessToken ? (
                <StreamResponse runId={runId} accessToken={accessToken} />
              ) : (
                <div className="flex justify-start">
                  <div className="flex items-start gap-3 max-w-[80%]">
                    <Avatar className="mt-0.5 border">
                      <AvatarFallback>AI</AvatarFallback>
                      <AvatarImage src="/placeholder.svg?height=40&width=40" />
                    </Avatar>
                    <div className="bg-muted rounded-lg px-4 py-2">
                      <Loader2 className="size-4 animate-spin" />
                    </div>
                  </div>
                </div>
              )}
            </>
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
