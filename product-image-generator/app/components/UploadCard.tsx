"use client";

import { Upload } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import type {
  ProductAnalysis,
  UploadTaskMetadata,
  UploadTaskOutput,
} from "../types/trigger";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { useRealtimeTaskTrigger } from "@trigger.dev/react-hooks";
import type { uploadImageToR2 } from "../../src/trigger/image-upload";

interface UploadCardProps {
  triggerToken: string;
  onUploadComplete?: (
    imageUrl: string,
    productAnalysis?: ProductAnalysis
  ) => void;
}

export default function UploadCard({
  triggerToken,
  onUploadComplete,
}: UploadCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [hasNotifiedComplete, setHasNotifiedComplete] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use realtime task trigger hook for immediate triggering
  const { submit, run, error, isLoading } = useRealtimeTaskTrigger<
    typeof uploadImageToR2
  >("upload-image-to-r2", {
    accessToken: triggerToken,
    enabled: Boolean(triggerToken),
  });

  // Derive UI state from run with proper types
  const meta = run?.metadata as UploadTaskMetadata | undefined;
  const progress = meta?.progress;
  const output = run?.output as UploadTaskOutput | undefined;
  const metadataResult = meta?.result;
  const publicUrl = output?.publicUrl ?? metadataResult?.publicUrl;
  const productAnalysis =
    output?.productAnalysis ?? metadataResult?.productAnalysis;

  // Clear local uploading state when run starts
  useEffect(() => {
    if (run?.id && isUploading) {
      setIsUploading(false);
    }
  }, [run?.id, isUploading]);

  // Notify parent when completed (only once)
  useEffect(() => {
    if (
      run?.status === "COMPLETED" &&
      publicUrl &&
      onUploadComplete &&
      !hasNotifiedComplete
    ) {
      onUploadComplete(publicUrl, productAnalysis);
      setHasNotifiedComplete(true);
    }
  }, [
    run?.status,
    publicUrl,
    productAnalysis,
    onUploadComplete,
    hasNotifiedComplete,
    output,
    metadataResult,
    run,
  ]);

  // Upload image
  const uploadImage = async (file: File) => {
    try {
      // Set loading state immediately
      setIsUploading(true);
      setHasNotifiedComplete(false);

      // Convert file to base64
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = buffer.toString("base64");

      submit({
        imageBuffer: base64,
        fileName: file.name,
        contentType: file.type,
      });
    } catch (err) {
      console.error("Upload failed:", err);
      setIsUploading(false);
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
    setHasNotifiedComplete(false);
  };

  return (
    <Card
      className={`aspect-[3/4] border-2 border-dashed transition-colors cursor-pointer group relative overflow-hidden ${
        isDragOver
          ? "border-blue-500 bg-blue-500/5"
          : "border-blue-500 bg-card hover:border-blue-500/80"
      } ${
        isUploading ||
        isLoading ||
        run?.status === "EXECUTING" ||
        run?.status === "QUEUED"
          ? "opacity-50 pointer-events-none"
          : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !publicUrl && fileInputRef.current?.click()}
    >
      {publicUrl ? (
        // Show uploaded image
        <div className="h-full w-full relative group">
          <img
            src={publicUrl}
            alt="Uploaded image"
            className="h-full w-full object-contain rounded-lg bg-gray-50"
            style={{
              opacity: run?.status === "COMPLETED" ? 1 : 0.7,
              transition: "opacity 0.3s ease-in-out",
            }}
          />
          {(isUploading ||
            isLoading ||
            run?.status === "EXECUTING" ||
            run?.status === "QUEUED") && (
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
      ) : isUploading || isLoading || run?.id ? (
        // Show progress state when loading or run exists
        <div className="h-full flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors bg-yellow-300/20">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
          <p className="text-sm font-medium text-card-foreground mb-1">
            {progress?.message ||
              (isUploading ? "Starting upload..." : "Processing...")}
          </p>
          <p className="text-xs text-muted-foreground">
            {progress
              ? `Step ${progress.step} of ${progress.total}`
              : isUploading
              ? "Preparing..."
              : "Please wait"}
          </p>
          {(progress || isUploading) && (
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{
                  width: progress
                    ? `${(progress.step / progress.total) * 100}%`
                    : "0%",
                }}
              ></div>
            </div>
          )}
          {run?.id && (
            <p className="text-xs text-blue-600 mt-2">Run ID: {run.id}</p>
          )}
          {error && (
            <p className="text-xs text-red-600 mt-2">Error: {error.message}</p>
          )}
        </div>
      ) : (
        // Show upload area
        <div className="h-full flex flex-col items-center justify-center p-6 text-center">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors ${
              isDragOver
                ? "bg-blue-500/10"
                : "bg-blue-500/10 group-hover:bg-blue-300/20 transition duration-200"
            }`}
          >
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm font-medium text-card-foreground mb-1">
            Drag and drop an image here
          </p>
          <p className="text-xs text-muted-foreground">or click to upload</p>
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
