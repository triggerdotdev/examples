"use client"

// =============================================================================
// CODE LINK COMPONENT
// =============================================================================
// This component makes any UI element "clickable" to highlight corresponding
// code in the CodePanel. It's the key to the interactive code viewer experience.
//
// How it works:
// 1. Wrap any element with <CodeLink mapping={...}>
// 2. When clicked, it calls setHighlight() from the SplitViewer context
// 3. The CodePanel receives the highlight state and highlights the specified lines
// 4. The CodePanel also auto-scrolls to the highlighted lines
//
// Example usage:
// <CodeLink mapping={{ file: "task.ts", lines: [10, 15] }}>
//   <Button>Click me to highlight code</Button>
// </CodeLink>
// =============================================================================

import { ReactNode } from "react"
import { useSplitViewer } from "./split-viewer"
import { CodeMapping } from "@/lib/code-mappings"

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

type CodeLinkProps = {
  // The mapping defines which file and lines to highlight
  mapping: CodeMapping
  // The content to wrap (any React node)
  children: ReactNode
  // Optional additional CSS classes
  className?: string
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * CodeLink wraps any element to make it highlight code when clicked.
 *
 * Features:
 * - Adds hover effect (subtle yellow background)
 * - Shows description as tooltip on hover
 * - Includes data-code-id attribute for testing/debugging
 *
 * @param mapping - Defines the file and line range to highlight
 * @param children - The element(s) to make clickable
 * @param className - Optional additional CSS classes
 */
export function CodeLink({ mapping, children, className = "" }: CodeLinkProps) {
  // Get the setHighlight function from the SplitViewer context
  // This updates the shared highlight state that CodePanel reads from
  const { setHighlight } = useSplitViewer()

  /**
   * Handle click - sets the highlight state in context.
   * The CodePanel component listens to this state and:
   * 1. Switches to the correct file tab
   * 2. Highlights the specified line range
   * 3. Scrolls the highlighted lines into view
   */
  const handleClick = () => {
    setHighlight({
      file: mapping.file,
      lines: mapping.lines,
    })
  }

  return (
    <span
      onClick={handleClick}
      // Styling: pointer cursor + hover effect for interactivity
      className={`cursor-pointer hover:bg-yellow-500/10 rounded transition-colors ${className}`}
      // data-code-id helps with debugging and automated testing
      data-code-id={mapping.file}
      // Show description as native browser tooltip
      title={mapping.description}
    >
      {children}
    </span>
  )
}
