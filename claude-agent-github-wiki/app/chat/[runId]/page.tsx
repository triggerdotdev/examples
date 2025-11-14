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

type Message = {
  id: string;
  type: "user" | "ai" | "tool";
  content: string;
  toolName?: string;
  toolInput?: any;
  toolResult?: string;
  timestamp: Date;
};

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

export default function ChatPage() {
  const searchParams = useSearchParams();
  const repo = searchParams.get("repo") || "";
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const repoName = repo.split("/").slice(-2).join("/").replace(".git", "");

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isRunning) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setIsRunning(true);

    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: "ai",
        content: "This is a demo. In a real implementation, the AI would analyze the repository and provide insights based on the codebase.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
      setIsRunning(false);
    }, 2000);
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
          {repo && (
            <Badge variant="secondary" className="font-normal">
              <a
                href={repo}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {repo}
              </a>
            </Badge>
          )}
        </div>
      </header>

      <ScrollArea className="flex-1 px-6" ref={scrollRef}>
        <div className="max-w-4xl mx-auto py-6 space-y-6">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Ask a question about this repository</p>
            </div>
          ) : (
            messages.map((message) => {
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
