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
} from "lucide-react";
import { agentStream } from "@/trigger/agent-stream";
import { analyzeRepo } from "@/trigger/analyze-repo";
import { useState } from "react";
import ReactMarkdown from "react-markdown";

export default function ResponsePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isAborting, setIsAborting] = useState(false);

  const runId = params.runId as string;
  const accessToken = searchParams.get("accessToken") || "";
  const question = searchParams.get("question") || "";

  // Subscribe to run metadata and status
  const { run, error: runError } = useRealtimeRun<typeof analyzeRepo>(runId, {
    accessToken,
  });

  // Subscribe to agent stream
  const { parts, error: streamError } = useRealtimeStream(agentStream, runId, {
    accessToken,
    timeoutInSeconds: 300, // 5 minute timeout
    throttleInMs: 50,
  });

  // Debug logging
  console.log("[Frontend] Stream state:", {
    runId,
    accessToken: accessToken ? "present" : "missing",
    partsLength: parts?.length || 0,
    streamError: streamError?.message,
    runStatus: run?.status,
  });

  // Log when parts change
  if (parts && parts.length > 0) {
    console.log(
      `[Frontend] Received ${parts.length} parts, latest:`,
      parts[parts.length - 1]?.slice(0, 100)
    );
  }

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
    } catch (error) {
      console.error("Error aborting:", error);
    }
    setIsAborting(false);
  };

  const handleNewQuestion = () => {
    router.push("/");
  };

  // Process streamed text chunks
  const getFormattedContent = () => {
    if (!parts || parts.length === 0) return null;

    // parts is now an array of text strings
    const combinedText = parts.join("");

    // Return the combined text as markdown
    if (combinedText.trim()) {
      return (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{combinedText}</ReactMarkdown>
        </div>
      );
    }

    return null;
  };

  const formattedContent = getFormattedContent();

  // Determine status
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
  const metadata = run?.metadata as any;
  const progress = metadata?.progress || 0;
  const statusText = metadata?.status || "Initializing...";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" onClick={handleNewQuestion} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Ask Another Question
          </Button>

          <h1 className="text-3xl font-bold mb-2">Repository Analysis</h1>
          {question && (
            <p className="text-muted-foreground">
              <span className="font-medium">Question:</span> {question}
            </p>
          )}
        </div>

        {/* Status Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
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
              Analysis Status
            </CardTitle>
            <CardDescription>{statusText}</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={progress} className="mb-2" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{metadata?.repository || "Repository"}</span>
              <span>{metadata?.repoSize || ""}</span>
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
                  "Cancel Analysis"
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Error Alert */}
        {(runError || streamError || metadata?.error) && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {metadata?.error ||
                runError?.message ||
                streamError?.message ||
                "An error occurred during analysis"}
            </AlertDescription>
          </Alert>
        )}

        {/* Response Content */}
        {(formattedContent || (parts && parts.length > 0)) && (
          <Card>
            <CardHeader>
              <CardTitle>Analysis Result</CardTitle>
            </CardHeader>
            <CardContent>
              {formattedContent || (
                <div className="text-muted-foreground">
                  Waiting for response...
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Completion Actions */}
        {status === "completed" && (
          <div className="mt-6 text-center">
            <Button onClick={handleNewQuestion} size="lg">
              Ask Another Question
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
