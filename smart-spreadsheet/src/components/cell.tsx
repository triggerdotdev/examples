"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw, ExternalLink } from "lucide-react";

interface CellProps {
  value: string | null;
  isLoading: boolean;
  error?: string;
  onRetry?: () => void;
  isLink?: boolean;
  sourceUrl?: string | null;
  linkStyle?: "underline" | "icon"; // underline = text is link, icon = hover icon
}

export function Cell({
  value,
  isLoading,
  error,
  onRetry,
  isLink,
  sourceUrl,
  linkStyle = "icon",
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

  // If sourceUrl exists, render based on linkStyle
  if (sourceUrl) {
    if (linkStyle === "underline") {
      // Underlined text, no icon (for data cells)
      return (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-foreground underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-blue-400 transition-colors"
          title={value}
        >
          {value}
        </a>
      );
    }
    // Hover icon style (for description)
    return (
      <span className="inline-flex items-center gap-1.5 max-w-full group">
        <span className="truncate" title={value}>
          {value}
        </span>
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-blue-400"
          title="View source"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </span>
    );
  }

  return (
    <span className="truncate" title={value}>
      {value}
    </span>
  );
}
