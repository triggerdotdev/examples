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
import type { analyzeRepo } from "@/trigger/analyze-repo";
import { useState } from "react";
import { Streamdown } from "streamdown";

interface RunMetadata {
  progress?: number;
  status?: string;
  repository?: string;
  repoSize?: string;
  error?: string;
}

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
  const combinedText = parts?.join("") || "";
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
  const isStreaming = status === "running" || status === "loading";
  const metadata = run?.metadata as RunMetadata | undefined;
  const progress = metadata?.progress || 0;
  const statusText = metadata?.status || "Initializing...";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" onClick={handleNewQuestion} className="mb-3">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Ask Another Question
          </Button>

          <h1 className="text-3xl font-bold mb-2">Repository Analysis</h1>
        </div>

        {/* Status Card */}
        <Card className="mb-4">
          <CardHeader>
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
                <span className="text-xl">Analysis Status:</span>
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
        {question && (
          <div className="flex items-center gap-2 bg-black/90 p-3 rounded-xl border mt-3 w-fit">
            <p className="text-white">
              <span className="font-medium text-white/70">Question:</span>{" "}
              {question}
            </p>
          </div>
        )}
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
        {combinedText.trim() && (
          <Card className="border-none">
            <CardContent className="p-0 py-4">
              <Streamdown isAnimating={isStreaming} mode="streaming">
                {combinedText}
              </Streamdown>
            </CardContent>
          </Card>
        )}

        {/* Completion Actions */}
        {status === "completed" && (
          <div className="mt-6 text-center place-self-start">
            <Button onClick={handleNewQuestion} size="lg">
              Ask Another Question
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
