"use client"

// =============================================================================
// CODE PANEL COMPONENT
// =============================================================================
// The CodePanel displays syntax-highlighted code with file tabs and line numbers.
// It's the right side of the split-screen viewer.
//
// Key features:
// 1. FILE TABS - Switch between different code files (task.ts, streams.ts, etc.)
// 2. SYNTAX HIGHLIGHTING - Code is highlighted using Shiki on the server
// 3. LINE NUMBERS - Each line has a number on the left
// 4. LINE HIGHLIGHTING - Specified lines can be highlighted (yellow background)
// 5. AUTO-SCROLL - When lines are highlighted, the panel scrolls to show them
// 6. TAB AUTO-SWITCH - When highlight is set to a different file, tab switches
//
// Architecture:
// - CodePanel: Main component with tabs and state management
// - CodeBlock: Renders the actual code with line numbers
// - ShikiLine: Extracts and renders a single line from Shiki HTML
// =============================================================================

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSplitViewer } from "./split-viewer"
import { useRef, useEffect, useState } from "react"

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Represents a code file to display in the panel.
 * Each file becomes a tab in the CodePanel.
 */
export type CodeFile = {
  // File name shown in the tab (e.g., "task.ts")
  name: string
  // Language for syntax highlighting (e.g., "typescript")
  language: string
  // Raw source code as a string
  code: string
  // Pre-rendered Shiki HTML (generated server-side for performance)
  html?: string
}

type CodePanelProps = {
  // Array of files to display as tabs
  files: CodeFile[]
}

// =============================================================================
// MAIN CODE PANEL COMPONENT
// =============================================================================

/**
 * CodePanel displays syntax-highlighted code with tabs for multiple files.
 *
 * Tab switching behavior:
 * 1. When highlight is set (from CodeLink), its file takes priority
 * 2. When user manually clicks a tab, that selection is remembered
 * 3. When neither exists, default to the first file
 *
 * @param files - Array of CodeFile objects to display
 */
export function CodePanel({ files }: CodePanelProps) {
  // Get highlight state from the SplitViewer context
  // highlight contains { file: string, lines: [number, number] } when set
  const { highlight, setHighlight } = useSplitViewer()

  // Track manually selected tab - this persists when highlight is cleared
  // This prevents the tab from jumping back to the first file after clicking
  const [manualTab, setManualTab] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // DERIVE ACTIVE FILE
  // ---------------------------------------------------------------------------
  // Priority order:
  // 1. highlight?.file - If code is highlighted, show that file
  // 2. manualTab - If user clicked a tab, show that file
  // 3. files[0]?.name - Default to first file
  // ---------------------------------------------------------------------------
  const activeFile = highlight?.file || manualTab || files[0]?.name

  /**
   * Handle manual tab change (user clicks a tab).
   * - Store the selection in manualTab state
   * - Clear any active highlight (so highlight doesn't override the selection)
   */
  const handleTabChange = (newTab: string) => {
    setManualTab(newTab)
    setHighlight(null) // Clear highlight when manually switching tabs
  }

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <Tabs
      value={activeFile}
      onValueChange={handleTabChange}
      className="h-full flex flex-col"
    >
      {/* Tab List - File names as clickable tabs */}
      <TabsList className="rounded-none bg-zinc-900 border-b border-zinc-800 justify-start px-2 h-10">
        {files.map((file) => (
          <TabsTrigger
            key={file.name}
            value={file.name}
            // Styling: dark theme with active state highlighting
            className="data-[state=active]:bg-zinc-800 rounded-sm text-zinc-400 data-[state=active]:text-zinc-100 text-xs font-mono"
          >
            {file.name}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* Tab Content - Code blocks for each file */}
      {files.map((file) => (
        <TabsContent
          key={file.name}
          value={file.name}
          className="flex-1 overflow-auto m-0 p-0"
        >
          <CodeBlock
            code={file.code}
            html={file.html}
            // Only pass highlight lines if this file is the highlighted one
            highlightLines={
              highlight?.file === file.name ? highlight.lines : undefined
            }
          />
        </TabsContent>
      ))}
    </Tabs>
  )
}

// =============================================================================
// CODE BLOCK COMPONENT
// =============================================================================

type CodeBlockProps = {
  // Raw source code (used for line count and fallback rendering)
  code: string
  // Pre-rendered Shiki HTML (optional - if not provided, renders plain text)
  html?: string
  // Line range to highlight [start, end] (1-indexed, inclusive)
  highlightLines?: [number, number]
}

/**
 * CodeBlock renders code with line numbers and optional highlighting.
 *
 * Rendering approach:
 * - We render each line individually (not using Shiki's full output)
 * - This allows us to add line numbers and highlighting to each line
 * - ShikiLine extracts the highlighted HTML for each line from Shiki's output
 *
 * @param code - Raw source code
 * @param html - Pre-rendered Shiki HTML (for syntax highlighting)
 * @param highlightLines - Optional line range to highlight
 */
function CodeBlock({ code, html, highlightLines }: CodeBlockProps) {
  // Ref for the container - used for scrolling to highlighted lines
  const containerRef = useRef<HTMLDivElement>(null)

  // Split code into individual lines for rendering
  const lines = code.split("\n")

  // ---------------------------------------------------------------------------
  // AUTO-SCROLL TO HIGHLIGHTED LINES
  // ---------------------------------------------------------------------------
  // When highlightLines changes, scroll the first highlighted line into view.
  // This is a valid use of useEffect - syncing with the DOM (scrolling).
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (highlightLines && containerRef.current) {
      // Find the DOM element for the first highlighted line
      const lineEl = containerRef.current.querySelector(
        `[data-line="${highlightLines[0]}"]`
      )
      // Scroll it into view with smooth animation, centered in the viewport
      lineEl?.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [highlightLines])

  // ---------------------------------------------------------------------------
  // RENDER CODE WITH LINE NUMBERS
  // ---------------------------------------------------------------------------

  return (
    <div ref={containerRef} className="text-sm font-mono">
      <div className="relative">
        {lines.map((line, i) => {
          const lineNum = i + 1 // Lines are 1-indexed for display

          // Check if this line should be highlighted
          const isHighlighted =
            highlightLines &&
            lineNum >= highlightLines[0] &&
            lineNum <= highlightLines[1]

          return (
            <div
              key={i}
              data-line={lineNum} // Used for scrollIntoView targeting
              className={`flex transition-colors duration-200 ${
                isHighlighted
                  ? "bg-yellow-500/20" // Highlighted: yellow background
                  : "hover:bg-zinc-800/50" // Not highlighted: subtle hover
              }`}
            >
              {/* Line Number Column */}
              <span className="w-12 text-right pr-4 py-0.5 text-zinc-600 select-none border-r border-zinc-800 bg-zinc-900/50">
                {lineNum}
              </span>

              {/* Code Content */}
              {html ? (
                // If we have Shiki HTML, extract and render the highlighted line
                <ShikiLine html={html} lineIndex={i} />
              ) : (
                // Fallback: render plain text (no syntax highlighting)
                <span className="pl-4 py-0.5 text-zinc-300">{line || " "}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =============================================================================
// SHIKI LINE COMPONENT
// =============================================================================

/**
 * ShikiLine extracts and renders a single line from Shiki's HTML output.
 *
 * Why we do this:
 * - Shiki renders the entire code block as one big HTML string
 * - We want to render each line separately (for line numbers, highlighting)
 * - So we parse Shiki's HTML and extract just the content for this line
 *
 * Shiki's output structure:
 * <pre><code>line1\nline2\nline3</code></pre>
 *
 * We extract the content between <code> tags and split by newlines.
 *
 * @param html - Full Shiki HTML output
 * @param lineIndex - Which line to extract (0-indexed)
 */
function ShikiLine({ html, lineIndex }: { html: string; lineIndex: number }) {
  // Extract content between <code> and </code> tags
  // This regex captures everything inside the code element
  const codeMatch = html.match(/<code[^>]*>([\s\S]*?)<\/code>/)

  // If no match, render empty space (shouldn't happen with valid Shiki output)
  if (!codeMatch) {
    return <span className="pl-4 py-0.5 text-zinc-300"> </span>
  }

  // Split the code content by newlines to get individual lines
  // Each line may contain HTML span tags for syntax highlighting
  const codeContent = codeMatch[1]
  const lines = codeContent.split("\n")

  // Get the HTML for this specific line
  const lineHtml = lines[lineIndex] || ""

  return (
    <span
      className="pl-4 py-0.5 flex-1"
      // Render the HTML string as actual HTML elements
      // This preserves Shiki's syntax highlighting spans
      dangerouslySetInnerHTML={{ __html: lineHtml || "&nbsp;" }}
    />
  )
}
