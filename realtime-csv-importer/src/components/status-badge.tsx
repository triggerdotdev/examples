import { Badge } from "@/components/ui/badge";
import { ProcessingStatus } from "@/lib/types";

export const StatusBadge = ({ status }: { status: ProcessingStatus }) => {
  const labels = {
    idle: "Ready",
    uploading: "Uploading",
    processing: "Processing",
    complete: "Completed",
  };

  return (
    <Badge variant="outline" className="bg-primary/10">
      {labels[status]}
    </Badge>
  );
};
