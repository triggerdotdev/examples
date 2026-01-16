"use client"

import { ReactNode } from "react"
import { useSplitViewer } from "./split-viewer"
import { CodeMapping } from "@/lib/code-mappings"

type CodeLinkProps = {
  mapping: CodeMapping
  children: ReactNode
  className?: string
}

// Wraps elements to highlight code on click
export function CodeLink({ mapping, children, className = "" }: CodeLinkProps) {
  const { setHighlight } = useSplitViewer()

  return (
    <span
      onClick={() => setHighlight({ file: mapping.file, lines: mapping.lines })}
      className={`cursor-pointer hover:bg-yellow-500/10 rounded transition-colors ${className}`}
      data-code-id={mapping.file}
      title={mapping.description}
    >
      {children}
    </span>
  )
}
