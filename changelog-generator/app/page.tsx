"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Github, Sparkles, AlertCircle, Calendar } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const exampleRepos = [
  {
    name: "Trigger.dev",
    url: "https://github.com/triggerdotdev/trigger.dev",
    description: "Background jobs framework",
  },
  {
    name: "Next.js",
    url: "https://github.com/vercel/next.js",
    description: "The React Framework",
  },
  {
    name: "Tailwind CSS",
    url: "https://github.com/tailwindlabs/tailwindcss",
    description: "Utility-first CSS framework",
  },
];

function getDefaultDates() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 1);

  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

export default function Home() {
  const defaults = getDefaultDates();
  const [repoUrl, setRepoUrl] = useState("");
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [isLoading, setIsLoading] = useState(false);
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

    if (!repoUrl) {
      setError("Please provide a repository URL.");
      return;
    }

    if (!validateGitHubUrl(repoUrl)) {
      setError("Please provide a valid GitHub repository URL.");
      return;
    }

    if (!startDate || !endDate) {
      setError("Please select both start and end dates.");
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError("Start date must be before end date.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/generate-changelog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "Failed to start changelog generation");
        setIsLoading(false);
        return;
      }

      const { runId, accessToken } = await response.json();

      const params = new URLSearchParams({
        accessToken,
        startDate,
        endDate,
      });
      router.push(`/response/${runId}?${params.toString()}`);
    } catch (err) {
      console.error("Failed to generate changelog:", err);
      setError("Failed to start changelog generation. Please try again.");
      setIsLoading(false);
    }
  };

  const handleExampleRepo = (url: string) => {
    setRepoUrl(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <div className="container mx-auto px-4 py-16 md:py-24 max-w-4xl">
        <div className="text-center space-y-6 mb-8">
          {/* <div className="flex items-center justify-center gap-2 mb-4">
            <Github className="w-8 h-8" />
            <Sparkles className="w-8 h-8" />
          </div> */}

          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Changelog generator
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Turn GitHub commits into developer-friendly changelogs using Claude
            Agent SDK with custom MCP tools + Trigger.dev.
          </p>
        </div>

        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="pb-2">Generate changelog</CardTitle>
            <CardDescription>
              Enter a GitHub repository and date range to generate a changelog
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="repo" className="text-sm font-medium">
                  GitHub repository URL
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="startDate" className="text-sm font-medium">
                    Start date
                  </label>
                  <div className="relative">
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="endDate" className="text-sm font-medium">
                    End date
                  </label>
                  <div className="relative">
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>

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
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Changelog
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Example Repositories */}
        <div className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold text-center">
            Try with popular repositories
          </h2>

          <div className="grid md:grid-cols-3 gap-4 max-w-2xl mx-auto">
            {exampleRepos.map((repo) => (
              <Card
                key={repo.url}
                className="cursor-pointer transition-all duration-200 hover:border-primary"
                onClick={() => handleExampleRepo(repo.url)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Github className="w-4 h-4" />
                    {repo.name}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {repo.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
