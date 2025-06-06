// components/csv-uploader/progress-section.tsx
"use client";

import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type ProgressStatus =
  | "queued"
  | "generating-search-queries"
  | "generating-search-results"
  | "generating-learnings"
  | "generating-report"
  | "generating-pdf"
  | "uploading-pdf-to-r2";

export type ProgressSectionProps = {
  status: ProgressStatus;
  progress: number;
  message: string;
  prompt?: string;
  durationInSeconds?: number;
  finalUrl?: string;
};

export function ProgressSection({
  status,
  progress,
  message,
  prompt,
  durationInSeconds,
  finalUrl,
}: ProgressSectionProps) {
  return (
    <div className="w-full space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{message}</p>
        <p className="text-sm font-medium">{Math.round(progress * 100)}%</p>
      </div>
      <Progress value={progress * 100} />
    </div>
  );
}
