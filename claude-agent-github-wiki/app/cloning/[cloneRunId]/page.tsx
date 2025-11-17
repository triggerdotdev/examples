"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useRealtimeRun } from "@trigger.dev/react-hooks";

export default function CloningPage() {
  const router = useRouter();
  const params = useParams();
  const cloneRunId = params.cloneRunId as string;

  // Subscribe to clone run status
  const { run, error: runError } = useRealtimeRun(cloneRunId);

  const isCompleted = run?.status === "COMPLETED";
  const isFailed = run?.status === "FAILED" || run?.status === "CRASHED";
  const isRunning = !isCompleted && !isFailed;

  const repoName = run?.output?.repoName || "Repository";
  const errorMessage = runError?.message || run?.error || "Clone failed";

  // Redirect when complete
  useEffect(() => {
    if (isCompleted) {
      const timer = setTimeout(() => {
        router.push(`/chat/${cloneRunId}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isCompleted, cloneRunId, router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {isRunning && (
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
            )}
            {isCompleted && (
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            )}
            {isFailed && (
              <XCircle className="w-12 h-12 text-red-500" />
            )}
          </div>
          <CardTitle>
            {isRunning && "Cloning repository..."}
            {isCompleted && "Clone complete!"}
            {isFailed && "Clone failed"}
          </CardTitle>
          <CardDescription>
            {isRunning && "Please wait while we clone the repository"}
            {isCompleted && `Redirecting to chat with ${repoName}...`}
            {isFailed && errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isRunning && (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>This may take a minute or two depending on the repository size.</p>
              <p className="text-xs">Run ID: {cloneRunId}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
