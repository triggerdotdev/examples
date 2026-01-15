"use client"

import { useState } from "react"
import type { Story } from "@/trigger/streams"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

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
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit story</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* ID (read-only) */}
          <div>
            <Label className="text-xs text-slate-500">ID</Label>
            <div className="text-sm font-mono text-slate-400">{story.id}</div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Acceptance criteria */}
          <div className="space-y-1.5">
            <Label htmlFor="acceptance" className="text-xs">
              Acceptance criteria (one per line)
            </Label>
            <Textarea
              id="acceptance"
              value={acceptance}
              onChange={(e) => setAcceptance(e.target.value)}
              rows={6}
              className="text-sm font-mono resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
