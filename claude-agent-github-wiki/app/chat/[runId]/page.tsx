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
import { agentStream } from "@/trigger/chat-with-repo";
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

const mockMessages: Message[] = [
  {
    id: "1",
    type: "user",
    content: "What are the main features of this repository?",
    timestamp: new Date(Date.now() - 120000),
  },
  {
    id: "2",
    type: "tool",
    content: "",
    toolName: "Read",
    toolInput: { file_path: "/README.md" },
    toolResult: `# Next.js

Next.js is a React framework for building full-stack web applications.

## Main Features

- **App Router**: A new router with support for layouts, nested routing, and more.
- **Server Components**: React Server Components for improved performance.
- **Data Fetching**: Simplified data fetching with async/await in Server Components.
- **Styling**: Support for CSS Modules, Tailwind CSS, and CSS-in-JS.
- **Optimizations**: Automatic image, font, and script optimizations.
- **TypeScript**: Built-in TypeScript support.

## Getting Started

\`\`\`bash
npx create-next-app@latest
\`\`\`

## Learn More

Visit [nextjs.org](https://nextjs.org) to learn more.`,
    timestamp: new Date(Date.now() - 115000),
  },
  {
    id: "3",
    type: "tool",
    content: "",
    toolName: "Grep",
    toolInput: { pattern: "export.*function", glob: "**/*.ts", output_mode: "files_with_matches" },
    toolResult: `packages/next/src/server/app-render.tsx
packages/next/src/server/base-server.ts
packages/next/src/client/components/app-router.tsx
packages/next/src/build/webpack/loaders/next-app-loader.ts
packages/next/src/server/lib/render-server.ts
[...25 more files]`,
    timestamp: new Date(Date.now() - 110000),
  },
  {
    id: "4",
    type: "ai",
    content: `Based on the README and codebase structure, here are the main features of this repository:

**Core Features:**

1. **App Router** - A new routing system with support for layouts, nested routes, and loading UI
2. **React Server Components** - Enables server-side rendering with reduced client-side JavaScript
3. **Simplified Data Fetching** - Uses async/await directly in components
4. **Built-in Optimizations** - Automatic image, font, and script optimizations for better performance
5. **Styling Flexibility** - Support for CSS Modules, Tailwind CSS, Sass, and CSS-in-JS solutions
6. **TypeScript Support** - First-class TypeScript integration out of the box

The codebase shows extensive server-side rendering capabilities and a robust build system. The App Router implementation spans across multiple modules handling routing, rendering, and webpack integration.`,
    timestamp: new Date(Date.now() - 105000),
  },
];

export default function ChatPage({ params }: { params: { runId: string } }) {
  const cloneRunId = params.runId;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [repoName, setRepoName] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [chatRunId, setChatRunId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Subscribe to realtime stream
  const { parts, error: streamError } = useRealtimeStream(
    agentStream,
    chatRunId ?? '',
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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isRunning) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const query = input;
    setInput("");
    setIsRunning(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cloneRunId, query }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send message");
      }

      const { chatRunId, accessToken, repoName: repo } = await response.json();
      if (repo && !repoName) setRepoName(repo);

      // Store for streaming
      setChatRunId(chatRunId);
      setAccessToken(accessToken);
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
          <span className="font-semibold">{repoName || "Repository"}</span>
          {cloneRunId && (
            <Badge variant="secondary" className="font-normal text-xs">
              Clone ID: {cloneRunId.substring(0, 8)}...
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
