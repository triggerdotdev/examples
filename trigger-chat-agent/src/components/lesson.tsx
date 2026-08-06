"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { reducedVariants, revealBlur } from "@/lib/motion";

/**
 * LessonView — renders a model-authored HTML lesson inside a SANDBOXED iframe.
 *
 * Security: the iframe uses `sandbox="allow-scripts"` WITHOUT `allow-same-origin`,
 * so the lesson runs in an opaque (null) origin. Its inline scripts (quiz logic)
 * work, but can't read the parent's cookies, localStorage, DOM, or the Trigger
 * session token — the same isolation model as Claude/v0 artifacts. The model's
 * HTML is dropped into `srcdoc` verbatim; we never trust it in the app origin.
 *
 * We inject the shared stylesheet (the "first component every workspace earns"
 * in the teach skill) so every lesson looks like one on-brand course, plus a
 * tiny resize script that posts the document height to the parent for a
 * seamless, chrome-free embed.
 */

// Shared lesson stylesheet — charcoal/apple palette, Satoshi headings, a
// Tufte-ish reading measure. Lives here (not Tailwind) because the sandboxed
// iframe is an isolated document and can't see the app's CSS.
const LESSON_CSS = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 24px 28px;
    background: #15171a; color: #d7d9dd;
    font: 15px/1.65 ui-sans-serif, system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  h1, h2, h3 { font-family: "Satoshi", ui-sans-serif, system-ui, sans-serif; color: #e8e9ec; line-height: 1.25; letter-spacing: -0.01em; }
  h2 { font-size: 1.35rem; margin: 0 0 0.5rem; }
  h3 { font-size: 1.05rem; margin: 1.5rem 0 0.4rem; }
  p { margin: 0.6rem 0; }
  a { color: #a8ff53; text-decoration: none; border-bottom: 1px solid #a8ff5340; }
  a:hover { border-bottom-color: #a8ff53; }
  code, pre { font-family: ui-monospace, "GeistMono-Regular", monospace; font-size: 0.86em; }
  code { background: #1a1b1f; padding: 0.1em 0.35em; border-radius: 4px; color: #cfffa0; }
  pre { background: #121317; border: 1px solid #272a2e; border-radius: 12px; padding: 14px 16px; overflow: auto; }
  pre code { background: none; padding: 0; color: #d7d9dd; }
  blockquote { margin: 1rem 0; padding: 0.4rem 0 0.4rem 1rem; border-left: 2px solid #272a2e; color: #878c99; }
  ul, ol { padding-left: 1.2rem; }
  li { margin: 0.3rem 0; }
  hr { border: 0; border-top: 1px solid #272a2e; margin: 1.5rem 0; }
  figure { margin: 1rem 0; }
  figcaption { font-size: 0.8rem; color: #878c99; margin-top: 0.4rem; }
  small, .muted { color: #878c99; }
  /* Quiz affordances — the model builds on these class hooks. */
  .quiz { margin: 1.25rem 0; padding: 1rem; background: #121317; border: 1px solid #272a2e; border-radius: 12px; }
  .quiz button, button.option {
    display: block; width: 100%; text-align: left; margin: 0.4rem 0; padding: 0.6rem 0.8rem;
    background: #1a1b1f; color: #d7d9dd; border: 1px solid #272a2e; border-radius: 8px;
    font: inherit; cursor: pointer; transition: background 120ms, border-color 120ms;
  }
  .quiz button:hover, button.option:hover { background: #272a2e; }
  .correct { border-color: #a8ff53 !important; background: #2e4e10 !important; color: #e4ffc9 !important; }
  .incorrect { border-color: #f43f5e !important; background: #3b1113 !important; }
  .feedback { margin-top: 0.6rem; font-size: 0.9rem; }
`;

const RESIZE_JS = `
  (function () {
    function post() {
      parent.postMessage({ __lesson: true, height: document.documentElement.scrollHeight }, "*");
    }
    window.addEventListener("load", post);
    if (window.ResizeObserver) new ResizeObserver(post).observe(document.documentElement);
    setTimeout(post, 50);
  })();
`;

function buildSrcDoc(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8" />
<link rel="preconnect" href="https://api.fontshare.com" crossorigin />
<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi@700,500&display=swap" />
<style>${LESSON_CSS}</style></head>
<body>${html}<script>${RESIZE_JS}</script></body></html>`;
}

export function LessonView({ title, html }: { title: string; html: string }) {
  const reduceMotion = useReducedMotion();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(240);

  // Genuine external event source: the sandboxed lesson posts its rendered
  // height so we can size the iframe to its content (no inner scrollbar).
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data as { __lesson?: boolean; height?: number };
      if (data?.__lesson && typeof data.height === "number") {
        setHeight(Math.min(2000, Math.max(160, Math.ceil(data.height))));
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <motion.div
      variants={reduceMotion ? reducedVariants : revealBlur}
      initial="hidden"
      animate="show"
      className="overflow-hidden rounded-[20px] border border-grid-dimmed bg-charcoal-850 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-2px_rgba(0,0,0,0.1)]"
    >
      <div className="flex items-center gap-2 border-b border-grid-bright bg-charcoal-800 px-4 py-3">
        <span className="size-2 rounded-full bg-apple-500" />
        <span className="font-title text-sm font-medium text-bright/80">{title}</span>
        <span className="ml-auto font-mono text-2xs uppercase tracking-wider text-dimmed/60">lesson</span>
      </div>
      <iframe
        ref={iframeRef}
        title={title}
        // Isolated origin: scripts run, but no access to the parent app,
        // its cookies, or the Trigger session token.
        sandbox="allow-scripts"
        srcDoc={buildSrcDoc(html)}
        className="w-full border-0 bg-charcoal-850"
        style={{ height }}
      />
    </motion.div>
  );
}
