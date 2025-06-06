export type DeepResearchStatus =
  | "idle"
  | "loading"
  | "queued"
  | "generating-search-queries"
  | "generating-search-results"
  | "generating-learnings"
  | "generating-report"
  | "generating-pdf"
  | "uploading-pdf-to-r2"
  | "completed"
  | "failed";
