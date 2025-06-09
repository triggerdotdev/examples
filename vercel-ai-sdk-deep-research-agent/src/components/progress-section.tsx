// components/csv-uploader/progress-section.tsx
"use client";

import { Progress } from "@/components/ui/progress";

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
}: ProgressSectionProps) {
  return (
    <div className="w-full space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm font-medium">{status}</p>
        <p className="text-sm font-medium">{message}</p>
      </div>
      <Progress value={progress ? progress * 100 : 0} />
    </div>
  );
}
