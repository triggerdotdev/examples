"use client"

import { useState } from "react"
import type { Story } from "@/trigger/streams"
import { Button } from "@/components/ui/button"

type Props = {
  story: Story
  onSave: (updated: Story) => void
  onCancel: () => void
}

export function StoryEditor({ story, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(story.title)
  const [acceptance, setAcceptance] = useState(story.acceptance.join("\n"))

  function handleSave() {
    onSave({
      ...story,
      title: title.trim(),
      acceptance: acceptance.split("\n").map(s => s.trim()).filter(Boolean),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          Edit story
        </h2>

        {/* ID (read-only) */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            ID
          </label>
          <div className="text-sm font-mono text-slate-400">{story.id}</div>
        </div>

        {/* Title */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Acceptance criteria */}
        <div className="mb-6">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Acceptance criteria (one per line)
          </label>
          <textarea
            value={acceptance}
            onChange={(e) => setAcceptance(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
