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
import { Github, Sparkles, AlertCircle } from "lucide-react";
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">
            Changelog generator
          </h1>
          <p className="mt-2 text-muted-foreground">
            Turn GitHub commits into developer-friendly changelogs using Claude
            Agent SDK with custom MCP tools + Trigger.dev.
          </p>
        </header>

        {/* Main Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>Generate changelog</CardTitle>
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
                  disabled={isLoading}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="startDate" className="text-sm font-medium">
                    Start date
                  </label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="endDate" className="text-sm font-medium">
                    End date
                  </label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={isLoading}
                  />
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
        <section className="mt-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">
            Try with popular repositories
          </h2>

          <div className="grid grid-cols-3 gap-4">
            {exampleRepos.map((repo) => (
              <Card
                key={repo.url}
                className="cursor-pointer transition-colors hover:border-primary"
                onClick={() => handleExampleRepo(repo.url)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Github className="w-4 h-4 shrink-0" />
                    <span className="truncate">{repo.name}</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {repo.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
