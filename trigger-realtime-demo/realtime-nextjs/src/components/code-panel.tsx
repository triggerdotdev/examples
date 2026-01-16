"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSplitViewer } from "./split-viewer"
import { useRef, useEffect, useState } from "react"

export type CodeFile = {
  name: string
  language: string
  code: string
  html?: string
}

type CodePanelProps = {
  files: CodeFile[]
}

export function CodePanel({ files }: CodePanelProps) {
  const { highlight, setHighlight } = useSplitViewer()
  const [manualTab, setManualTab] = useState<string | null>(null)

  // Priority: highlight file > manual selection > first file
  const activeFile = highlight?.file || manualTab || files[0]?.name

  const handleTabChange = (newTab: string) => {
    setManualTab(newTab)
    setHighlight(null)
  }

  return (
    <Tabs value={activeFile} onValueChange={handleTabChange} className="h-full flex flex-col">
      <TabsList className="rounded-none bg-zinc-900 border-b border-zinc-800 justify-start px-2 h-10">
        {files.map((file) => (
          <TabsTrigger
            key={file.name}
            value={file.name}
            className="data-[state=active]:bg-zinc-800 rounded-sm text-zinc-400 data-[state=active]:text-zinc-100 text-xs font-mono"
          >
            {file.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {files.map((file) => (
        <TabsContent key={file.name} value={file.name} className="flex-1 overflow-auto m-0 p-0">
          <CodeBlock
            code={file.code}
            html={file.html}
            highlightLines={highlight?.file === file.name ? highlight.lines : undefined}
          />
        </TabsContent>
      ))}
    </Tabs>
  )
}

type CodeBlockProps = {
  code: string
  html?: string
  highlightLines?: [number, number]
}

function CodeBlock({ code, html, highlightLines }: CodeBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const lines = code.split("\n")

  // Scroll to highlighted lines when they change
  useEffect(() => {
    if (highlightLines && containerRef.current) {
      const lineEl = containerRef.current.querySelector(`[data-line="${highlightLines[0]}"]`)
      lineEl?.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [highlightLines])

  return (
    <div ref={containerRef} className="text-sm font-mono">
      <div className="relative">
        {lines.map((line, i) => {
          const lineNum = i + 1
          const isHighlighted = highlightLines && lineNum >= highlightLines[0] && lineNum <= highlightLines[1]

          return (
            <div
              key={i}
              data-line={lineNum}
              className={`flex transition-colors duration-200 ${
                isHighlighted ? "animate-highlight-pulse" : "hover:bg-zinc-800/50"
              }`}
            >
              <span className="w-12 text-right pr-4 py-0.5 text-zinc-600 select-none border-r border-zinc-800 bg-zinc-900/50">
                {lineNum}
              </span>
              {html ? (
                <ShikiLine html={html} lineIndex={i} />
              ) : (
                <span className="pl-4 py-0.5 text-zinc-300">{line || " "}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Extracts a single line from Shiki's <pre><code>...</code></pre> output
function ShikiLine({ html, lineIndex }: { html: string; lineIndex: number }) {
  const codeMatch = html.match(/<code[^>]*>([\s\S]*?)<\/code>/)
  if (!codeMatch) {
    return <span className="pl-4 py-0.5 text-zinc-300"> </span>
  }

  const lines = codeMatch[1].split("\n")
  const lineHtml = lines[lineIndex] || ""

  return (
    <span
      className="pl-4 py-0.5 flex-1"
      dangerouslySetInnerHTML={{ __html: lineHtml || "&nbsp;" }}
    />
  )
}
