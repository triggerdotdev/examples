// hooks/useProcessingStatus.ts
import { ProcessingStatus } from "@/lib/types"; // You'll need to define this type

interface UseProcessingStatusProps {
  status: ProcessingStatus;
  progress: number;
}

export const useProcessingStatus = ({
  status,
  progress,
}: UseProcessingStatusProps): ProcessingStatus => {
  if (status === "idle") return "idle";
  if (status === "uploading") return "uploading";
  if (status === "processing") {
    return progress === 100 ? "complete" : "processing";
  }
  return "complete";
};
