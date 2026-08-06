"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const PROSE =
  "prose-sm max-w-[65ch] leading-relaxed text-bright [&_a]:text-apple-500 [&_a]:underline [&_code]:rounded [&_code]:bg-charcoal-900 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_code]:text-apple-200";

/**
 * Assistant prose. While the tokens are still streaming in, reveal them
 * word-by-word with a blur-in (the ".word-in" keyframe) so live text reads as
 * materializing. Once the turn is done, re-render as full markdown (links,
 * inline code). Keying words by index means already-shown words don't
 * re-animate as the final word grows.
 */
export function AssistantText({ text, streaming }: { text: string; streaming: boolean }) {
  if (!streaming) {
    return (
      <div className={PROSE}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
    );
  }

  const tokens = text.split(/(\s+)/);
  return (
    <p className={`${PROSE} whitespace-pre-wrap`}>
      {tokens.map((t, i) => (
        <span key={i} className={/^\s+$/.test(t) ? undefined : "word-in"}>
          {t}
        </span>
      ))}
    </p>
  );
}
