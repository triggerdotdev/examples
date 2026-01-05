"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw, ExternalLink } from "lucide-react";

interface CellProps {
  value: string | null;
  isLoading: boolean;
  error?: string;
  onRetry?: () => void;
  isLink?: boolean;
}

export function Cell({
  value,
  isLoading,
  error,
  onRetry,
  isLink,
}: CellProps) {
  if (error) {
    return (
      <div className="flex items-center gap-2 text-destructive">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span className="text-xs">Failed</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 w-full">
        <RefreshCw className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
        <Skeleton className="h-4 flex-1" />
      </div>
    );
  }

  if (!value) {
    return <span className="text-muted-foreground/50">—</span>;
  }

  if (isLink) {
    return (
      <a
        href={value.startsWith("http") ? value : `https://${value}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 group"
      >
        <span className="truncate max-w-[160px]">
          {value.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
        </span>
        <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </a>
    );
  }

  return (
    <span className="truncate block" title={value}>
      {value}
    </span>
  );
}
