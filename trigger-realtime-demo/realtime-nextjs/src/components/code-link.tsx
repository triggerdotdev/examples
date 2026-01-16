"use client"

import { ReactNode } from "react"
import { useSplitViewer } from "./split-viewer"
import { CodeMapping } from "@/lib/code-mappings"

type CodeLinkProps = {
  mapping: CodeMapping
  children: ReactNode
  className?: string
}

export function CodeLink({ mapping, children, className = "" }: CodeLinkProps) {
  const { setHighlight } = useSplitViewer()

  const handleClick = () => {
    setHighlight({
      file: mapping.file,
      lines: mapping.lines,
    })
  }

  return (
    <span
      onClick={handleClick}
      className={`cursor-pointer hover:bg-yellow-500/10 rounded transition-colors ${className}`}
      data-code-id={mapping.file}
      title={mapping.description}
    >
      {children}
    </span>
  )
}
