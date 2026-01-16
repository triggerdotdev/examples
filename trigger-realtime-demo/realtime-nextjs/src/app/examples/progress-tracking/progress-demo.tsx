"use client"

import { Button } from "@/components/ui/button"

export function ProgressDemo() {
  // Placeholder - will connect to Trigger.dev in Story 4-5
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button>Start Task</Button>
        <span className="text-sm text-muted-foreground">
          Click to start processing
        </span>
      </div>

      <div className="rounded-lg border p-4 bg-muted/30">
        <p className="text-sm text-muted-foreground">
          Progress updates will appear here once connected to Trigger.dev
        </p>
      </div>
    </div>
  )
}
