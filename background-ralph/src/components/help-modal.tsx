"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  )
}
