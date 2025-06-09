// components/csv-uploader/progress-section.tsx
"use client";

import { Progress } from "@/components/ui/progress";

export type ProgressSectionProps = {
  status: string;
  progress: number;
  message: string;
  prompt?: string;
  durationInSeconds?: number;
  finalUrl?: string;
};

export function ProgressSection({ progress }: ProgressSectionProps) {
  return (
    <div className="w-full space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm font-medium">{Math.round(progress * 100)}%</p>
      </div>
      <Progress value={progress * 100} />
    </div>
  );
}
