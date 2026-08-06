"use client";

export function StatView({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string | null;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {caption && <div className="mt-1 text-xs text-muted-foreground">{caption}</div>}
    </div>
  );
}
