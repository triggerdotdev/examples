"use client";

import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Upload } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { uploadImageToR2Action } from "../actions";
import { runs, configure } from "@trigger.dev/sdk/v3";

interface UploadCardProps {
  onUploadComplete?: (imageUrl: string) => void;
}

export default function UploadCard({ onUploadComplete }: UploadCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>("idle");
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [progressStep, setProgressStep] = useState<{
    step: number;
    total: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to run updates when runId and accessToken are available
  useEffect(() => {
    if (!runId || !accessToken) return;

    const subscribeToRun = async () => {
      try {
        // Configure the SDK with the public access token for client-side authentication
        configure({
          accessToken: accessToken,
        });

        for await (const run of runs.subscribeToRun(runId)) {
          // Update progress from metadata
          if (run.metadata?.progress) {
            const progress = run.metadata.progress as {
              step: number;
              total: number;
              message: string;
            };
            setProgressMessage(progress.message);
            setProgressStep({ step: progress.step, total: progress.total });
          }

          // Handle completion
          if (run.status === "COMPLETED" && run.output) {
            setUploadedImageUrl(run.output.publicUrl);
            setUploadProgress("completed");
            setProgressMessage("Upload completed!");
            setIsLoading(false);

            // Notify parent component
            if (onUploadComplete && run.output.publicUrl) {
              onUploadComplete(run.output.publicUrl);
            }
            break;
          } else if (run.status === "FAILED") {
            const errorMsg = run.metadata?.error || "Upload failed";
            setError(typeof errorMsg === "string" ? errorMsg : "Upload failed");
            setUploadProgress("idle");
            setProgressMessage("");
            setIsLoading(false);
            break;
          }
        }
      } catch (err) {
        setError("Failed to get task updates");
        setUploadProgress("idle");
        setIsLoading(false);
      }
    };

    subscribeToRun();
  }, [runId, accessToken]);

  // Upload image with realtime subscription
  const uploadImage = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setUploadProgress("uploading");
    setUploadedImageUrl(null);
    setProgressMessage("");
    setProgressStep(null);

    try {
      // Create FormData and upload
      const formData = new FormData();
      formData.append("image", file);

      const result = await uploadImageToR2Action(formData);

      if (result.success && result.runId && result.accessToken) {
        setRunId(result.runId);
        setAccessToken(result.accessToken);
        setUploadProgress("processing");
        // The useEffect will handle the subscription
      } else {
        setError(result.error || "Failed to upload image");
        setUploadProgress("idle");
        setIsLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
      setUploadProgress("idle");
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find((file) => file.type.startsWith("image/"));

    if (imageFile) {
      await uploadImage(imageFile);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      await uploadImage(file);
    }
  };

  const handleReset = () => {
    setUploadedImageUrl(null);
    setUploadProgress("idle");
    setRunId(null);
    setAccessToken(null);
    setError(null);
    setProgressMessage("");
    setProgressStep(null);
  };

  return (
    <Card
      className={`aspect-[3/4] border-2 border-dashed transition-colors cursor-pointer group relative overflow-hidden ${
        isDragOver
          ? "border-primary bg-primary/5"
          : "border-primary/30 bg-card hover:border-primary/50"
      } ${isLoading ? "opacity-50 pointer-events-none" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !uploadedImageUrl && fileInputRef.current?.click()}
    >
      {uploadedImageUrl ? (
        // Show uploaded image
        <div className="h-full w-full relative group">
          <img
            src={uploadedImageUrl}
            alt="Uploaded image"
            className="h-full w-full object-cover rounded-lg"
            style={{
              opacity: uploadProgress === "completed" ? 1 : 0.7,
              transition: "opacity 0.3s ease-in-out",
            }}
          />
          {uploadProgress === "processing" && (
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                handleReset();
              }}
            >
              Replace
            </Button>
          </div>
        </div>
      ) : (
        // Show upload area
        <div className="h-full flex flex-col items-center justify-center p-6 text-center">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors ${
              isDragOver
                ? "bg-primary/20"
                : "bg-primary/10 group-hover:bg-primary/20"
            }`}
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            ) : (
              <Upload className="h-6 w-6 text-primary" />
            )}
          </div>
          <p className="text-sm font-medium text-card-foreground mb-1">
            {uploadProgress === "uploading"
              ? "Uploading..."
              : uploadProgress === "processing"
              ? progressMessage || "Processing..."
              : "Drag and drop an image here"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isLoading
              ? progressStep
                ? `Step ${progressStep.step} of ${progressStep.total}`
                : "Please wait"
              : "or click to browse"}
          </p>
          {progressStep && uploadProgress === "processing" && (
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${(progressStep.step / progressStep.total) * 100}%`,
                }}
              ></div>
            </div>
          )}
          {runId && uploadProgress !== "idle" && (
            <p className="text-xs text-blue-600 mt-2">Run ID: {runId}</p>
          )}
          {error && <p className="text-xs text-red-600 mt-2">Error: {error}</p>}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </Card>
  );
}
