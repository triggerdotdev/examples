import { Badge } from "@/components/ui/badge";
import { DeepResearchStatus } from "@/lib/types";

const statusLabels: Record<DeepResearchStatus, string> = {
  idle: "Idle",
  loading: "Loading",
  queued: "Queued",
  "generating-search-queries": "Generating Queries",
  "generating-search-results": "Searching",
  "generating-learnings": "Synthesizing",
  "generating-report": "Generating Report",
  "generating-pdf": "Creating PDF",
  "uploading-pdf-to-r2": "Uploading",
  completed: "Completed",
  failed: "Failed",
};

export const StatusBadge = ({ status }: { status: DeepResearchStatus }) => {
  return (
    <Badge variant="outline" className="bg-primary/10">
      {statusLabels[status] || "Unknown"}
    </Badge>
  );
};
