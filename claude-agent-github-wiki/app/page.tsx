"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Github,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const exampleQuestions = [
  "What is the architecture of this codebase?",
  "How does the authentication system work?",
  "What are the main API endpoints?",
  "Identify potential security vulnerabilities",
  "Explain the data flow in this application",
  "What testing strategies are used?",
];

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
    description: "GitHub repository for VS Code",
    stars: "158k",
    warning: true, // Large repo
  },
];

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const validateGitHubUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return (
        urlObj.hostname === "github.com" &&
        urlObj.pathname.split("/").length >= 3
      );
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!repoUrl || !question) {
      setError("Please provide both a repository URL and a question.");
      return;
    }

    if (!validateGitHubUrl(repoUrl)) {
      setError("Please provide a valid GitHub repository URL.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/analyze-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl, question }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "Failed to start analysis");
        setIsLoading(false);
        return;
      }

      const { runId, accessToken } = await response.json();

      // Navigate to response page with run ID and access token
      const params = new URLSearchParams({
        accessToken,
        question,
      });
      router.push(`/response/${runId}?${params.toString()}`);
    } catch (error) {
      console.error("Failed to analyze repo:", error);
      setError("Failed to start analysis. Please try again.");
      setIsLoading(false);
    }
  };

  const handleExampleRepo = (url: string) => {
    setRepoUrl(url);
    // Focus on question field
    document.getElementById("question")?.focus();
  };

  const handleExampleQuestion = (q: string) => {
    setQuestion(q);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <div className="container mx-auto px-4 py-16 md:py-24 max-w-4xl">
        <div className="text-center space-y-6 mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Github className="w-8 h-8" />
            <Sparkles className="w-8 h-8" />
          </div>

          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Analyze any GitHub Repository
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Ask questions about any public GitHub repository and get detailed
            AI-powered analysis, powered by Trigger.dev and Claude.
          </p>
        </div>

        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Repository Analysis</CardTitle>
            <CardDescription>
              Enter a GitHub repository URL and ask a question about the
              codebase
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="repo" className="text-sm font-medium">
                  GitHub Repository URL
                </label>
                <Input
                  id="repo"
                  type="url"
                  placeholder="https://github.com/username/repository"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="w-full"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="question" className="text-sm font-medium">
                  Your Question
                </label>
                <Textarea
                  id="question"
                  placeholder="What would you like to know about this repository?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className="w-full min-h-[100px]"
                  disabled={isLoading}
                />
              </div>

              {/* Example Questions */}
              <Collapsible open={showExamples} onOpenChange={setShowExamples}>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full"
                  >
                    {showExamples ? (
                      <>
                        <ChevronUp className="w-4 h-4 mr-2" />
                        Hide example questions
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-2" />
                        Show example questions
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  {exampleQuestions.map((q, idx) => (
                    <Button
                      key={idx}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full text-left justify-start"
                      onClick={() => handleExampleQuestion(q)}
                    >
                      {q}
                    </Button>
                  ))}
                </CollapsibleContent>
              </Collapsible>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Analyze Repository
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Example Repositories */}
        <div className="mt-12 space-y-4">
          <h2 className="text-xl font-semibold text-center">
            Try with popular repositories
          </h2>

          <div className="grid md:grid-cols-3 gap-4 max-w-2xl mx-auto">
            {exampleRepos.map((repo) => (
              <Card
                key={repo.url}
                className="cursor-pointer transition-all duration-200 flex flex-col"
                onClick={() => handleExampleRepo(repo.url)}
              >
                <CardHeader className="pb-2 flex flex-1">
                  <CardTitle className="flex items-center gap-2 text-base ">
                    <Github className="w-4 h-4" />
                    {repo.name}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {repo.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-xs text-muted-foreground">
                      <svg
                        className="w-3 h-3 mr-1 fill-current"
                        viewBox="0 0 16 16"
                      >
                        <path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z" />
                      </svg>
                      {repo.stars}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
