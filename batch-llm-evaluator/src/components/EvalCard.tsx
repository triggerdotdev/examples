"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function EvalCard({
  id,
  response,
  isSelected,
  name,
  value,
  tag,
}: {
  id: string;
  response: string;
  isSelected: boolean;
  name: string;
  value: string;
  tag?: string;
}) {
  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-300",
        "bg-gray-900/50 backdrop-blur-sm border-gray-800",
        "hover:border-gray-700",
        isSelected && "border-gray-600 bg-gray-800/50"
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-gray-800/5 via-transparent to-transparent pointer-events-none" />
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <RadioGroupItem
              value={value}
              id={id}
              className="border-gray-600 text-gray-200"
            />
            <Label
              htmlFor={id}
              className="text-sm font-medium cursor-pointer text-gray-200"
            >
              {name}
            </Label>
          </div>
          {tag && (
            <Badge
              variant="secondary"
              className="bg-gray-800 text-gray-300 border border-gray-700"
            >
              {tag}
            </Badge>
          )}
        </div>
        <ScrollArea className="h-[200px] pr-4">
          <p className="text-sm leading-relaxed text-gray-400">{response}</p>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
