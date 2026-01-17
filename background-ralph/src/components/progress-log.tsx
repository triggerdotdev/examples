"use client"

import { useEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"

type Props = {
  progress: string | null
  isActive?: boolean
}

export function ProgressLog({ progress, isActive = false }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when progress updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [progress])

  if (!progress) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-[12px]">
        <div className="text-center space-y-2">
          <p className="text-[16px]">{isActive ? "" : ""}</p>
          <p>{isActive ? "Progress will appear as stories complete" : "No progress yet"}</p>
        </div>
      </div>
    )
  }

  // Parse progress into sections
  const sections = progress.split("\n\n").filter(Boolean)

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50">
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
          Progress
        </span>
        <span className="text-[10px] text-slate-400">
          {sections.length} {sections.length === 1 ? "story" : "stories"} logged
        </span>
      </div>
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-3 space-y-4">
          {sections.map((section, i) => {
            const lines = section.split("\n")
            const title = lines[0]?.replace(/^###?\s*/, "") || ""
            const items = lines.slice(1).filter(Boolean)

            return (
              <div key={i} className="text-[12px]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-emerald-500"></span>
                  <span className="font-medium text-slate-700">{title}</span>
                </div>
                {items.length > 0 && (
                  <ul className="ml-5 space-y-0.5 text-slate-500">
                    {items.map((item, j) => (
                      <li key={j} className="leading-relaxed">
                        {item.replace(/^-\s*/, "")}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
