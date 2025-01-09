// components/csv-uploader/progress-section.tsx
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CSVBatchStatus } from "@/utils/schemas";

interface ProgressSectionProps {
  status: "uploading" | "processing";
  progress: number;
  uploadProgress: number;
  emailsProcessed: number;
  emailsRemaining: number;
  batches: Array<CSVBatchStatus>;
}

export const ProgressSection = ({
  status,
  progress,
  uploadProgress,
  emailsProcessed,
  emailsRemaining,
  batches,
}: ProgressSectionProps) => (
  <>
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">
          {status === "uploading" ? "Upload Progress" : "Processing Progress"}
        </span>
        <span className="font-mono">
          {status === "uploading" ? uploadProgress.toFixed(0) : progress}%
        </span>
      </div>
      <Progress
        value={status === "uploading" ? uploadProgress : progress}
        className="h-2"
      />
    </div>

    <div className="grid grid-cols-2 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="text-2xl font-bold">{emailsProcessed}</div>
          <div className="text-sm text-muted-foreground">Emails Processed</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-2xl font-bold">{emailsRemaining}</div>
          <div className="text-sm text-muted-foreground">Remaining</div>
        </CardContent>
      </Card>
    </div>

    <div className="space-y-4">
      <h3 className="text-sm font-medium">Batch Status</h3>
      <div className="space-y-2">
        {(batches ?? []).map((batch, batchId) => {
          return (
            <div
              key={batchId}
              className="flex items-center justify-between p-3 text-sm bg-muted rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Badge
                  variant={
                    batch.status === "complete"
                      ? "default"
                      : batch.status === "processing"
                      ? "secondary"
                      : "outline"
                  }
                  className="w-24 justify-center"
                >
                  {batch.status}
                </Badge>
                <span>Batch {batchId + 1}</span>
              </div>
              <div className="font-mono text-muted-foreground">
                {batch.processed}/{batch.count}
              </div>
            </div>
          );
        })}
      </div>
    </div>

    <div className="pt-4 border-t">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-muted-foreground">Estimated Time</div>
          <div className="font-mono">
            ~{Math.ceil((100 - progress) / 10)} min remaining
          </div>
        </div>
      </div>
    </div>
  </>
);
