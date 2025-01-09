"use client";

import { CompletedSection } from "@/components/completed-section";
import { Dropzone } from "@/components/dropzone";
import { ProgressSection } from "@/components/progress-section";
import { StatusBadge } from "@/components/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeCSVValidator } from "@/hooks/useRealtimeCSVValidator";
import { useProcessingStatus } from "@/hooks/useProcessingStatus";
import { ProcessingStatus } from "@/lib/types";
import { useUploadThing } from "@/utils/uploadthing";
import { useDropzone } from "@uploadthing/react";
import { Terminal } from "lucide-react";
import { useCallback, useState } from "react";
import {
  generateClientDropzoneAccept,
  generatePermittedFileTypes,
} from "uploadthing/client";

export default function CSVUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [runHandle, setRunHandle] = useState<{
    id: string;
    publicAccessToken: string;
  } | null>(null);

  const { toast } = useToast();

  // useCSVUpload wraps useRealtimeRun from @trigger.dev/react-hooks
  // See the implementation in hooks/useCSVUpload.ts
  const csvValidation = useRealtimeCSVValidator(
    runHandle?.id,
    runHandle?.publicAccessToken
  );

  const {
    totalProcessed: emailsProcessed = 0,
    totalRows: totalEmails = 0,
    totalValid = 0,
    totalInvalid = 0,
    totalApiCalls = 0,
    batches = [],
  } = csvValidation;

  const emailsRemaining = totalEmails - emailsProcessed;
  const progress = Math.round(
    Math.min(100, (emailsProcessed / totalEmails) * 100)
  );

  // We will compute the status as "completed" if the progress is 100%
  const currentStatus = useProcessingStatus({ status, progress });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { startUpload, routeConfig } = useUploadThing("csvUploader", {
    onClientUploadComplete: (res) => {
      setStatus("processing");
      toast({
        title: "Upload complete",
        description: `File ${file?.name} has been uploaded successfully. Processing started.`,
      });

      // serverData is the "handle" returned from tasks.trigger
      // See this call in the uploadthing router in src/app/api/uploadthing/core.ts
      setRunHandle(res[0].serverData);
    },
    onUploadError: (error) => {
      setStatus("idle");
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onUploadProgress(p) {
      setUploadProgress(p);
    },
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: generateClientDropzoneAccept(
      generatePermittedFileTypes(routeConfig).fileTypes
    ),
    multiple: false,
  });

  const handleUpload = async () => {
    if (!file) return;

    await startUpload([file]);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-2 mb-8">
          <Terminal className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">CSV Email Validation</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>{file ? file.name : "Upload CSV"}</CardTitle>
                <CardDescription>
                  {getStatusDescription(currentStatus, totalEmails)}
                </CardDescription>
              </div>
              <StatusBadge status={currentStatus} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentStatus === "idle" && (
              <Dropzone
                getRootProps={getRootProps}
                getInputProps={getInputProps}
                isDragActive={isDragActive}
                file={file}
                onUpload={handleUpload}
              />
            )}

            {(currentStatus === "uploading" ||
              currentStatus === "processing") && (
              <ProgressSection
                status={currentStatus}
                progress={progress}
                uploadProgress={uploadProgress}
                emailsProcessed={emailsProcessed}
                emailsRemaining={emailsRemaining}
                batches={batches}
              />
            )}

            {currentStatus === "complete" && (
              <CompletedSection
                totalValid={totalValid}
                totalInvalid={totalInvalid}
                totalEmails={totalEmails}
                totalApiCalls={totalApiCalls}
                durationInSeconds={csvValidation.durationInSeconds}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function getStatusDescription(status: ProcessingStatus, totalEmails: number) {
  switch (status) {
    case "idle":
      return "Drop your CSV file here or click to select";
    case "uploading":
      return "Uploading CSV file...";
    case "processing":
      return `Processing ${totalEmails} email addresses`;
    case "complete":
      return `Processed ${totalEmails} email addresses`;
    default:
      return "";
  }
}
