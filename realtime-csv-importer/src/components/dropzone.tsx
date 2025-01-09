// components/csv-uploader/dropzone.tsx
import { File, Upload, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DropzoneProps {
  getRootProps: any;
  getInputProps: any;
  isDragActive: boolean;
  file: File | null;
  onUpload: () => void;
}

export const Dropzone = ({
  getRootProps,
  getInputProps,
  isDragActive,
  file,
  onUpload,
}: DropzoneProps) => (
  <>
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
        isDragActive
          ? "border-primary bg-primary/10"
          : "border-muted-foreground/25 hover:border-primary/50"
      }`}
    >
      <input {...getInputProps()} />
      <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
      {isDragActive ? (
        <p>Drop the CSV file here ...</p>
      ) : (
        <p>Drag 'n' drop a CSV file here, or click to select a file</p>
      )}
      <p className="text-xs text-muted-foreground mt-2">CSV files only</p>
    </div>

    {file && (
      <div className="mt-4 p-4 bg-muted rounded-lg flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <File className="h-5 w-5 text-primary" />
          <span className="font-medium">{file.name}</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {(file.size / 1024 / 1024).toFixed(2)} MB
        </span>
      </div>
    )}

    {!file && (
      <div className="mt-4 p-4 bg-yellow-500/10 rounded-lg flex items-center space-x-2">
        <AlertCircle className="h-5 w-5 text-yellow-500" />
        <p className="text-sm text-yellow-500">No file selected</p>
      </div>
    )}

    <Button className="w-full mt-6" onClick={onUpload} disabled={!file}>
      Upload and Process CSV
    </Button>
  </>
);
