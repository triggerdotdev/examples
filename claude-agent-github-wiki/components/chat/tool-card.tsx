"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileText, Search, Terminal, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolCardProps {
  toolName: string;
  toolInput: any;
  toolResult?: string;
  timestamp: Date;
}

const toolIcons = {
  Read: FileText,
  Grep: Search,
  Bash: Terminal,
  default: Terminal,
};

export function ToolCard({ toolName, toolInput, toolResult, timestamp }: ToolCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = toolIcons[toolName as keyof typeof toolIcons] || toolIcons.default;

  const resultLines = toolResult?.split("\n").length || 0;
  const shouldCollapse = resultLines > 50;

  return (
    <div className="animate-in fade-in slide-in-from-left-4 duration-300">
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-xs">
                  {toolName}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1.5">Input:</div>
            <pre className="bg-secondary p-3 rounded-lg overflow-x-auto text-xs">
              {JSON.stringify(toolInput, null, 2)}
            </pre>
          </div>

          {toolResult && (
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-muted-foreground">
                  Result: {shouldCollapse && `(${resultLines} lines)`}
                </div>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    {isOpen ? (
                      <>
                        <ChevronDown className="w-3 h-3" />
                        Collapse
                      </>
                    ) : (
                      <>
                        <ChevronRight className="w-3 h-3" />
                        Expand
                      </>
                    )}
                  </button>
                </CollapsibleTrigger>
              </div>

              <CollapsibleContent className="mt-1.5">
                <pre className="bg-secondary p-3 rounded-lg overflow-x-auto text-xs max-h-96 overflow-y-auto">
                  {toolResult}
                </pre>
              </CollapsibleContent>

              {!isOpen && (
                <pre className="bg-secondary p-3 rounded-lg overflow-hidden text-xs mt-1.5 relative">
                  <div className="line-clamp-3">{toolResult}</div>
                  {shouldCollapse && (
                    <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-secondary to-transparent pointer-events-none" />
                  )}
                </pre>
              )}
            </Collapsible>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
