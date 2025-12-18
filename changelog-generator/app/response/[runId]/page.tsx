"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useRealtimeRun, useRealtimeStream } from "@trigger.dev/react-hooks";
import { Streamdown } from "streamdown";
import { ArrowLeft, AlertCircle, Calendar, Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { changelogStream } from "@/trigger/changelog-stream";

interface RunMetadata {
  repository?: string;
  commitCount?: number;
  error?: string;
  agent?: {
    phase: string;
    turns: number;
    toolCalls: { tool: string; input: string }[];
    diffsInvestigated: string[];
  };
  summary?: {
    durationSec: number;
  };
}

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
      currentCategory = line.replace("## ", "").trim();
    } else if (line.startsWith("### ")) {
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

export default function ResponsePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const runId = params.runId as string;
  const accessToken = searchParams.get("accessToken") || "";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";

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
  const sections = useMemo(
    () => parseChangelogSections(combinedText),
    [combinedText]
  );

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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        {/* Header */}
        <header className="mb-8">
          <Button
            variant="ghost"
            onClick={handleNewChangelog}
            className="-ml-3 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <h1 className="text-2xl font-bold tracking-tight">
            Changelog entries
          </h1>
        </header>

        {/* Error Alert */}
        {(runError || streamError || metadata?.error) && (
          <Alert variant="destructive" className="mb-8">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {metadata?.error ||
                runError?.message ||
                streamError?.message ||
                "An error occurred during changelog generation"}
            </AlertDescription>
          </Alert>
        )}

        {/* Agent Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-muted-foreground font-medium">
                Claude is cooking...
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                {metadata?.agent?.phase || "Initializing..."}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Repository & Date Range */}
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{metadata?.repository || "Repository"}</span>
              <span className="text-border">|</span>
              <Calendar className="w-4 h-4" />
              <span>
                {startDate} to {endDate}
              </span>
            </div>

            {/* Stats */}
            {metadata?.agent && (
              <div className="text-xs font-mono text-muted-foreground space-y-2">
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
                  <div className="opacity-60">
                    Investigated: {metadata.agent.diffsInvestigated.join(", ")}
                  </div>
                )}
                {metadata.agent.toolCalls.length > 0 && (
                  <div className="space-y-1 opacity-60">
                    {metadata.agent.toolCalls.map((call, i) => (
                      <div key={i}>
                        {call.tool}({call.input})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Changelog Cards */}
        {combinedText.trim() && (
          <div className="mt-8 pb-4 space-y-4">
            {sections.map((section, i) => (
              <Card key={i}>
                <CardHeader className="flex gap-4">
                  <div className="flex items-center w-full justify-between gap-4 shrink-0">
                    <div className="gap-3 flex items-center">
                      {section.category && (
                        <span className="text-xs font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                          {section.category}
                        </span>
                      )}
                      {section.date && (
                        <span className="text-xs text-muted-foreground">
                          {section.date}
                        </span>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopySection(section, i)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      {copiedIndex === i ? (
                        <>
                          <Check className="w-3 h-3 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 mr-1" />
                          Copy MDX
                        </>
                      )}
                    </Button>
                  </div>
                  <CardTitle>{section.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Streamdown
                    isAnimating={isStreaming && i === sections.length - 1}
                    mode="streaming"
                    shikiTheme={["github-dark", "github-dark"]}
                  >
                    {section.content}
                  </Streamdown>
                </CardContent>
              </Card>
            ))}

            {/* Thinking text - shown before changelog sections appear */}
            {isStreaming && sections.length === 0 && (
              <div className="text-xs font-mono text-muted-foreground/70 leading-relaxed">
                <Streamdown isAnimating={isStreaming} mode="streaming">
                  {combinedText}
                </Streamdown>
              </div>
            )}
          </div>
        )}

        {/* Completion Actions */}
        {status === "completed" && (
          <div className="mt-8">
            <Button onClick={handleNewChangelog}>
              Generate Another Changelog
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
