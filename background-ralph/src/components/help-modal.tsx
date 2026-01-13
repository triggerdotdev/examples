"use client"

import { useEffect } from "react"

type Props = {
  isOpen: boolean
  onClose: () => void
}

const shortcuts = [
  { key: "C", action: "Continue to next story" },
  { key: "S", action: "Stop execution" },
  { key: "E", action: "Edit selected story" },
  { key: "↑ / k", action: "Navigate up" },
  { key: "↓ / j", action: "Navigate down" },
  { key: "?", action: "Show this help" },
  { key: "Esc", action: "Close modal" },
]

export function HelpModal({ isOpen, onClose }: Props) {
  // Close on escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          Keyboard shortcuts
        </h2>

        <div className="space-y-2">
          {shortcuts.map(({ key, action }) => (
            <div key={key} className="flex items-center justify-between py-1">
              <span className="text-sm text-slate-600">{action}</span>
              <kbd className="px-2 py-1 text-xs font-mono bg-slate-100 text-slate-700 rounded border border-slate-200">
                {key}
              </kbd>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-200 rounded-md hover:bg-slate-50"
        >
          Close
        </button>
      </div>
    </div>
  )
}
