"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useRealtimeRun, useRealtimeStream } from "@trigger.dev/react-hooks";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Loader2,
  XCircle,
  Calendar,
  GitCommit,
  Copy,
  Check,
} from "lucide-react";
import { changelogStream } from "@/trigger/changelog-stream";
import { useState } from "react";
import { Streamdown } from "streamdown";

interface ToolCall {
  tool: string;
  input: string;
  timestamp: string;
}

interface AgentState {
  phase: string;
  turns: number;
  toolCalls: ToolCall[];
  diffsInvestigated: string[];
  commitCount?: number;
  currentDiff?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

interface Summary {
  diffsChecked: number;
  agentTurns: number;
  durationSec: number;
}

interface RunMetadata {
  progress?: number;
  status?: string;
  repository?: string;
  commitCount?: number;
  error?: string;
  agent?: AgentState;
  summary?: Summary;
}

// Parse markdown into individual entries by ### headings
function parseChangelogSections(
  markdown: string
): Array<{ title: string; content: string; category?: string; date?: string }> {
  const sections: Array<{
    title: string;
    content: string;
    category?: string;
    date?: string;
  }> = [];
  const lines = markdown.split("\n");
  let currentCategory = "";
  let currentTitle = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      // Track category but don't create a section for it
      currentCategory = line.replace("## ", "").trim();
    } else if (line.startsWith("### ")) {
      // Save previous entry
      if (currentTitle) {
        const { content, date } = extractDate(currentContent.join("\n").trim());
        sections.push({
          title: currentTitle,
          content,
          category: currentCategory || undefined,
          date,
        });
      }
      currentTitle = line.replace("### ", "").trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // Save last entry
  if (currentTitle) {
    const { content, date } = extractDate(currentContent.join("\n").trim());
    sections.push({
      title: currentTitle,
      content,
      category: currentCategory || undefined,
      date,
    });
  }

  return sections.filter((s) => s.content.length > 0);
}

// Extract [DATE: Dec 7] from end of content
function extractDate(content: string): { content: string; date?: string } {
  const dateMatch = content.match(/\[DATE:\s*([^\]]+)\]\s*$/);
  if (dateMatch) {
    return {
      content: content.replace(/\[DATE:\s*[^\]]+\]\s*$/, "").trim(),
      date: dateMatch[1].trim(),
    };
  }
  return { content };
}

// Parse date string like "Dec 7" or "Dec 7-9" into sortable value (newest first)
function parseDateForSort(dateStr?: string): number {
  if (!dateStr) return 0;
  const months: Record<string, number> = {
    Jan: 1,
    Feb: 2,
    Mar: 3,
    Apr: 4,
    May: 5,
    Jun: 6,
    Jul: 7,
    Aug: 8,
    Sep: 9,
    Oct: 10,
    Nov: 11,
    Dec: 12,
  };
  // Handle "Dec 7" or "Dec 7-9" - use last day for ranges
  const match = dateStr.match(/([A-Za-z]+)\s+(\d+)(?:-(\d+))?/);
  if (match) {
    const month = months[match[1]] || 0;
    const day = parseInt(match[3] || match[2], 10);
    return month * 100 + day;
  }
  return 0;
}

// Sort sections by date, newest first
function sortByDateDesc<T extends { date?: string }>(sections: T[]): T[] {
  return [...sections].sort(
    (a, b) => parseDateForSort(b.date) - parseDateForSort(a.date)
  );
}

export default function ResponsePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isAborting, setIsAborting] = useState(false);

  const runId = params.runId as string;
  const accessToken = searchParams.get("accessToken") || "";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const { run, error: runError } = useRealtimeRun(runId, { accessToken });

  const { parts, error: streamError } = useRealtimeStream(
    changelogStream,
    runId,
    {
      accessToken,
      timeoutInSeconds: 300,
      throttleInMs: 50,
    }
  );

  const handleAbort = async () => {
    setIsAborting(true);
    try {
      const response = await fetch("/api/abort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });

      if (!response.ok) {
        console.error("Failed to abort");
      }
    } catch (err) {
      console.error("Error aborting:", err);
    }
    setIsAborting(false);
  };

  const handleNewChangelog = () => {
    router.push("/");
  };

  const handleCopySection = async (
    section: { title: string; content: string; category?: string },
    index: number
  ) => {
    const mdx = `### ${section.title}\n\n${section.content}`;
    await navigator.clipboard.writeText(mdx);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const combinedText = parts?.join("") || "";

  const getStatus = () => {
    if (runError || streamError) return "error";
    if (!run) return "loading";

    switch (run.status) {
      case "COMPLETED":
        return "completed";
      case "FAILED":
      case "CANCELED":
      case "CRASHED":
      case "SYSTEM_FAILURE":
        return "error";
      case "EXECUTING":
      case "QUEUED":
        return "running";
      default:
        return "loading";
    }
  };

  const status = getStatus();
  const isStreaming = status === "running" || status === "loading";
  const metadata = run?.metadata as RunMetadata | undefined;
  const progress = metadata?.progress || 0;
  const statusText = metadata?.status || "Initializing...";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={handleNewChangelog}
            className="mb-3 p-0"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Generate another changelog
          </Button>

          <h1 className="text-3xl font-bold mb-2">Changelog generation</h1>
        </div>

        {/* Status Card
        <Card className="mb-4 p-0">
          <CardHeader className="p-6">
            <CardTitle className="flex justify-between gap-2">
              <div className="flex items-center gap-2">
                {status === "loading" && (
                  <Loader2 className="w-5 h-5 animate-spin" />
                )}
                {status === "running" && (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                )}
                {status === "completed" && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                {status === "error" && (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                <span className="text-xl">Status:</span>
              </div>
              <CardDescription className="text-lg font-medium">
                {statusText}
              </CardDescription>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={progress} className="mb-3" />
            <div className="flex justify-between text-sm text-muted-foreground h-4">
              <span>{metadata?.repository || "Repository"}</span>
              {metadata?.commitCount && (
                <span className="flex items-center gap-1">
                  <GitCommit className="w-3 h-3" />
                  {metadata.commitCount} commits
                </span>
              )}
            </div>

            {status === "running" && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={handleAbort}
                disabled={isAborting}
              >
                {isAborting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Aborting...
                  </>
                ) : (
                  "Cancel"
                )}
              </Button>
            )}
          </CardContent>
        </Card> */}

        {/* Error Alert */}
        {(runError || streamError || metadata?.error) && (
          <Alert variant="destructive" className="mb-6 mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {metadata?.error ||
                runError?.message ||
                streamError?.message ||
                "An error occurred during changelog generation"}
            </AlertDescription>
          </Alert>
        )}

        {/* Agent Stats */}

        <Card className="mt-4 bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400 flex justify-between">
              <span>Claudey is cooking...</span>
              <span className="text-zinc-600">
                {metadata?.agent?.phase || "Initializing..."}
              </span>
            </CardTitle>
            <div className="flex items-center gap-2 rounded-xl w-fit my-3 text-sm">
              <span className="text-zinc-500">
                {metadata?.repository || "Repository"}
              </span>
              <Calendar className="w-5 h-5 text-zinc-400" />
              <p className="text-zinc-500">
                {startDate} to {endDate}
              </p>
            </div>
          </CardHeader>
          <CardContent className="text-xs font-mono text-zinc-500 space-y-2">
            {metadata?.agent && (
              <>
                <div className="flex gap-4">
                  {metadata?.commitCount && (
                    <span>{metadata.commitCount} commits</span>
                  )}
                  <span>{metadata.agent.turns} turns</span>
                  {metadata.agent.diffsInvestigated.length > 0 && (
                    <span>
                      {metadata.agent.diffsInvestigated.length} diffs checked
                    </span>
                  )}
                  {metadata.summary?.durationSec && (
                    <span>{metadata.summary.durationSec}s</span>
                  )}
                </div>
                {metadata.agent.diffsInvestigated.length > 0 && (
                  <div className="text-zinc-600">
                    Investigated: {metadata.agent.diffsInvestigated.join(", ")}
                  </div>
                )}
                <div className="space-y-1 text-zinc-600">
                  {metadata.agent.toolCalls.map((call, i) => (
                    <div key={i}>
                      {call.tool}({call.input})
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Changelog Content - Split into cards by section */}
        {combinedText.trim() && (
          <>
            {parseChangelogSections(combinedText).map((section, i) => (
              <Card key={i} className="mt-4">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      {section.category && (
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {section.category}
                        </span>
                      )}
                      <CardTitle className="text-lg">{section.title}</CardTitle>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {section.date && (
                        <span className="text-xs text-muted-foreground">
                          {section.date}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopySection(section, i)}
                        className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {copiedIndex === i ? (
                          <>
                            <Check className="w-3 h-3" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            Copy MDX
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Streamdown
                    isAnimating={
                      isStreaming &&
                      i === parseChangelogSections(combinedText).length - 1
                    }
                    mode="streaming"
                  >
                    {section.content}
                  </Streamdown>
                </CardContent>
              </Card>
            ))}
            {/* Show streaming content while building if no sections parsed yet */}
            {isStreaming &&
              parseChangelogSections(combinedText).length === 0 && (
                <Card className="mt-4 p-4">
                  <CardContent className="p-0">
                    <Streamdown isAnimating={isStreaming} mode="streaming">
                      {combinedText}
                    </Streamdown>
                  </CardContent>
                </Card>
              )}
          </>
        )}

        {/* Completion Actions */}
        {status === "completed" && (
          <div className="mt-6 text-center place-self-start">
            <Button onClick={handleNewChangelog} size="lg">
              Generate Another Changelog
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
