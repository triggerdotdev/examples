// components/csv-uploader/progress-section.tsx
"use client";

import { Progress } from "@/components/ui/progress";
import { Badge } from "./ui/badge";

export type ProgressSectionProps = {
  status: string;
  progress?: number;
  message?: string;
  prompt?: string;
  durationInSeconds?: number;
  finalUrl?: string;
};

export function ProgressSection({
  progress,
  status,
  message,
  prompt,
}: ProgressSectionProps) {
  return (
    <div className="w-full space-y-3 min-h-32">
      <div className="flex justify-between items-center gap-2">
        <p className="text-sm font-semibold truncate w-[80%]">
          {prompt || " "}
        </p>
        <Badge variant="default" className="gap-2">
          {status === "EXECUTING" && (
            <div className="inline-flex items-center">
              <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {status || " "}
        </Badge>
      </div>

      <Progress value={progress} />
      <p className="text-sm font-medium">{message || " "}</p>
    </div>
  );
}
