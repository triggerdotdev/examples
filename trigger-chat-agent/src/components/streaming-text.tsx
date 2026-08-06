"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const PROSE =
  "prose-sm max-w-[65ch] leading-relaxed text-bright [&_a]:text-apple-500 [&_a]:underline [&_code]:rounded [&_code]:bg-charcoal-900 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_code]:text-apple-200";

/**
 * Assistant prose. Renders markdown as the tokens stream in (the standard AI SDK
 * approach) — the text simply grows, no per-word reveal, so it reads snappy.
 */
export function AssistantText({ text }: { text: string }) {
  return (
    <div className={PROSE}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
