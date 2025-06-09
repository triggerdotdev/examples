import { Badge } from "@/components/ui/badge";

export const StatusBadge = ({ label }: { label: string }) => {
  return (
    <Badge variant="outline" className="bg-primary/10">
      {label}
    </Badge>
  );
};
