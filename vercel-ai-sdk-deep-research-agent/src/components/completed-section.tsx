// components/csv-uploader/completed-section.tsx
import { Check, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface CompletedSectionProps {
  totalValid: number;
  totalInvalid: number;
  totalEmails: number;
  totalApiCalls: number;
  durationInSeconds?: number;
}

export const CompletedSection = ({
  totalValid,
  totalInvalid,
  totalEmails,
  totalApiCalls,
  durationInSeconds,
}: CompletedSectionProps) => {
  const summaryItems = [
    { label: "Total Processed", value: totalValid + totalInvalid },
    {
      label: "Success Rate",
      value: `${((totalValid / totalEmails) * 100).toFixed(1)}%`,
    },
    { label: "API Calls Used", value: totalApiCalls },
    {
      label: "Processing Time",
      value: durationInSeconds ? `${durationInSeconds}s` : "N/A",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-4 py-6">
        <div className="rounded-full bg-green-500/10 p-3">
          <Check className="h-6 w-6 text-green-500" />
        </div>
        <h2 className="text-2xl font-semibold">Processing Complete</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalValid}</div>
            <div className="text-sm text-muted-foreground">Valid Emails</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalInvalid}</div>
            <div className="text-sm text-muted-foreground">Invalid Emails</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Summary</h3>
        <div className="space-y-2">
          {summaryItems.map((item) => (
            <div key={item.label} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-mono">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t">
        <Button className="w-full">
          <Download className="mr-2 h-4 w-4" /> Download Results CSV
        </Button>
      </div>
    </div>
  );
};
