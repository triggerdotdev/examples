"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const PROSE = [
  "max-w-[65ch] text-[0.9375rem] leading-7 text-bright sm:text-base",
  "[&_p]:[text-wrap:pretty] [&_p:not(:last-child)]:mb-4",
  "[&_h1]:mb-3 [&_h1]:font-title [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight",
  "[&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:font-title [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight",
  "[&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:font-title [&_h3]:text-lg [&_h3]:font-semibold",
  "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5",
  "[&_ol]:my-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5",
  "[&_li]:pl-1 [&_li]:[text-wrap:pretty] [&_li::marker]:text-charcoal-500",
  "[&_strong]:font-semibold [&_strong]:text-foreground",
  "[&_a]:text-apple-400 [&_a]:underline [&_a]:decoration-apple-500/40 [&_a]:underline-offset-4 [&_a:hover]:decoration-apple-400",
  "[&_code]:rounded-md [&_code]:bg-charcoal-900 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.8125rem] [&_code]:text-apple-200",
  "[&_pre]:my-4 [&_pre]:max-w-full [&_pre]:overflow-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-grid-dimmed [&_pre]:bg-charcoal-900 [&_pre]:p-4",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-charcoal-650 [&_blockquote]:pl-4 [&_blockquote]:text-dimmed",
].join(" ");

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
