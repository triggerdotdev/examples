// hooks/useProcessingStatus.ts
import { DeepResearchStatus } from "@/lib/types"; // You'll need to define this type

interface UseProcessingStatusProps {
  status: DeepResearchStatus;
  progress: number;
}

export const useProcessingStatus = ({
  status,
  progress,
}: UseProcessingStatusProps): DeepResearchStatus => {
  return status;
};
