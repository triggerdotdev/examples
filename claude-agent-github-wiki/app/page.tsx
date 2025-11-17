"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Github, MessageSquare, Sparkles } from "lucide-react";

const exampleRepos = [
  {
    name: "Next.js",
    url: "https://github.com/vercel/next.js",
    description: "The React Framework for Production",
    stars: "120k",
  },
  {
    name: "React",
    url: "https://github.com/facebook/react",
    description: "A JavaScript library for building UIs",
    stars: "220k",
  },
  {
    name: "VS Code",
    url: "https://github.com/microsoft/vscode",
    description: "Visual Studio Code",
    stars: "158k",
  },
];

export default function Home() {
  const [url, setUrl] = useState("");
  const router = useRouter();

  const handleSubmit = async (repoUrl: string) => {
    try {
      const response = await fetch("/api/analyze-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubUrl: repoUrl }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Failed to start cloning");
        return;
      }

      const { cloneRunId } = await response.json();
      router.push(`/cloning/${cloneRunId}`);
    } catch (error) {
      console.error("Failed to clone repo:", error);
      alert("Failed to start cloning. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <div className="container mx-auto px-4 py-16 md:py-24 max-w-6xl">
        <div className="text-center space-y-6 mb-16">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Github className="w-12 h-12" />
            <MessageSquare className="w-12 h-12" />
          </div>

          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Chat with any GitHub repo
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Paste a GitHub repository URL and ask questions about the codebase.
            Watch AI analyze the code in real-time with live reasoning and tool usage.
          </p>

          <div className="max-w-2xl mx-auto mt-8">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (url) handleSubmit(url);
              }}
              className="flex gap-2"
            >
              <Input
                type="url"
                placeholder="https://github.com/username/repository"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 h-12 text-base"
              />
              <Button type="submit" size="lg" className="h-12 px-8">
                <Sparkles className="w-4 h-4 mr-2" />
                Start Chat
              </Button>
            </form>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-center mb-6">
            Try these popular repositories
          </h2>

          <div className="grid md:grid-cols-3 gap-4">
            {exampleRepos.map((repo) => (
              <Card
                key={repo.url}
                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
                onClick={() => handleSubmit(repo.url)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Github className="w-5 h-5" />
                    {repo.name}
                  </CardTitle>
                  <CardDescription>{repo.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <svg className="w-4 h-4 mr-1 fill-current" viewBox="0 0 16 16">
                      <path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z" />
                    </svg>
                    {repo.stars} stars
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="mt-16 text-center text-sm text-muted-foreground">
          <p>
            This demo showcases AI-powered repository analysis with real-time tool usage streaming
          </p>
        </div>
      </div>
    </div>
  );
}
