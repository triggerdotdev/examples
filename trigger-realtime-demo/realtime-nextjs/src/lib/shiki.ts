import { createHighlighter, Highlighter } from "shiki"

let highlighter: Highlighter | null = null

export async function getHighlighter() {
  if (!highlighter) {
    highlighter = await createHighlighter({
      themes: ["tokyo-night"],
      langs: ["typescript", "tsx", "javascript", "json", "bash"],
    })
  }
  return highlighter
}

export async function highlightCode(code: string, lang: string): Promise<string> {
  const h = await getHighlighter()
  return h.codeToHtml(code, {
    lang,
    theme: "tokyo-night",
  })
}
