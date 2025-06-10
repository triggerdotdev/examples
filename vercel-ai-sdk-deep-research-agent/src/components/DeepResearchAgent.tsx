"use client";

import { ProgressSection } from "@/components/progress-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { deepResearchOrchestrator } from "@/trigger/deepResearch";
import { useRealtimeTaskTrigger } from "@trigger.dev/react-hooks";
import { Search, Telescope } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

export const ProgressMetadataSchema = z.object({
  status: z.object({
    progress: z.number(),
    label: z.string(),
  }),
  pdfName: z.string().optional(),
});

export type ProgressMetadata = z.infer<typeof ProgressMetadataSchema>;

export function parseStatus(data: unknown): ProgressMetadata {
  return ProgressMetadataSchema.parse(data);
}

export function DeepResearchAgent({ triggerToken }: { triggerToken: string }) {
  const [prompt, setPrompt] = useState("");
  const [promptError, setPromptError] = useState<string | null>(null);

  const triggerInstance = useRealtimeTaskTrigger<
    typeof deepResearchOrchestrator
  >("deep-research", {
    accessToken: triggerToken,
    baseURL: process.env.NEXT_PUBLIC_TRIGGER_API_URL,
  });

  const run = triggerInstance.run;

  let progress = 0;
  let label = " ";
  let pdfTitle = "";

  if (run?.metadata) {
    console.log("values", run.metadata);
    const { status, pdfName } = parseStatus(run.metadata);
    progress = status.progress;
    label = status.label;
    pdfTitle = pdfName || "";
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (prompt.length < 30) {
      setPromptError("Research prompt must be at least 30 characters.");
      return;
    }

    setPromptError(null);
    triggerInstance.submit({ prompt });
  };

  const isSubmitDisabled = prompt.length < 30 || prompt.length > 1000;

  return (
    <div className="min-h-screen bg-white text-foreground p-6 flex place-items-center justify-center">
      <div className="max-w-2xl w-full mx-auto space-y-6">
        <div className="flex items-center justify-center gap-3 mb-6">
          <Telescope className="w-8 h-8" />
          <h1 className="text-4xl font-bold">Deep Research Agent</h1>
        </div>

        <Card className="pt-6">
          <CardContent className="space-y-6">
            {!run && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="prompt"
                    className="text-lg font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    What would you like to research?
                  </label>
                  <Textarea
                    id="prompt"
                    placeholder="Enter your research question or topic here..."
                    className="min-h-[120px] resize-none"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Describe what you'd like to research. Your prompt must be at
                    least 30 characters long.
                  </p>
                  {promptError && (
                    <p className="text-sm font-medium text-destructive">
                      {promptError}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={isSubmitDisabled}
                  className="w-full max-w-56"
                >
                  <Search className="w-4 h-4" />
                  Start Deep Research
                </Button>
              </form>
            )}

            {run && run.status !== "COMPLETED" && (
              <ProgressSection
                prompt={prompt}
                status={run?.status || " "}
                progress={progress}
                message={label}
              />
            )}

            {run && run.status === "COMPLETED" && (
              <div className="space-y-4 text-center">
                <h3 className="text-2xl font-bold">Research Complete!</h3>
                <p className="font-semibold"> "{prompt}"</p>
                <p>
                  Your detailed research report is ready. You can view and
                  download it now.
                </p>

                <Button asChild>
                  <a
                    href={`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${pdfTitle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Final Report
                  </a>
                </Button>
              </div>
            )}

            {run?.status === "FAILED" && (
              <div className="space-y-4 text-center">
                <h3 className="text-2xl font-bold text-destructive">
                  Research Failed
                </h3>
                <p>Unfortunately, the research could not be completed.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
