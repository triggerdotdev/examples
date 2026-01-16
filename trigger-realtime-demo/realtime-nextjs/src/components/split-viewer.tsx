"use client"

import { ReactNode, createContext, useContext, useState } from "react"

type HighlightState = {
  file: string
  lines: [number, number]
} | null

type SplitViewerContextType = {
  highlight: HighlightState
  setHighlight: (h: HighlightState) => void
}

const SplitViewerContext = createContext<SplitViewerContextType | null>(null)

export function useSplitViewer() {
  const ctx = useContext(SplitViewerContext)
  if (!ctx) throw new Error("useSplitViewer must be used within SplitViewer")
  return ctx
}

type SplitViewerProps = {
  appPanel: ReactNode
  codePanel: ReactNode
}

export function SplitViewer({ appPanel, codePanel }: SplitViewerProps) {
  const [highlight, setHighlight] = useState<HighlightState>(null)

  return (
    <SplitViewerContext.Provider value={{ highlight, setHighlight }}>
      <div className="flex h-screen">
        {/* Left: App Panel */}
        <div className="w-1/2 border-r border-border overflow-auto p-6 bg-background">
          {appPanel}
        </div>
        {/* Right: Code Panel */}
        <div className="w-1/2 overflow-auto bg-zinc-950">
          {codePanel}
        </div>
      </div>
    </SplitViewerContext.Provider>
  )
}
