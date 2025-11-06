"use client";

import { generateImage } from "@/trigger/generate-images";
import { useRealtimeRun } from "@trigger.dev/react-hooks";
import { useRouter } from "next/navigation";
import { ImageUploadDropzone } from "./ImageUploadButton";
import { Button } from "./ui/button";

type UploadCardProps = {
  runId?: string;
  accessToken?: string;
  fileUrl?: string;
};

export function UploadCard({ runId, accessToken, fileUrl }: UploadCardProps) {
  const isGenerating = Boolean(runId && accessToken);

  // Subscribe to the run
  const { run, error } = useRealtimeRun<typeof generateImage>(runId, {
    accessToken: accessToken,
    enabled: isGenerating,
  });

  const router = useRouter();

  return (
    <div className="aspect-[3/4] w-full border transition-colors relative overflow-hidden group bg-card p-0 rounded-lg">
      {fileUrl ? (
        <div className="h-full w-full relative group">
          <img
            src={fileUrl}
            alt="Uploaded image"
            className="h-full w-full object-cover rounded-lg bg-gray-50"
          />
          {run?.isCompleted && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push("/");
                }}
              >
                Replace
              </Button>
            </div>
          )}
        </div>
      ) : (
        <ImageUploadDropzone />
      )}
    </div>
  );
}
