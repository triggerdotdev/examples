"use client"

import { Button } from "@/components/ui/button"
import { CodeLink } from "@/components/code-link"
import { progressMappings } from "@/lib/code-mappings"

export function ProgressDemo() {
  // Placeholder - will connect to Trigger.dev in Story 4-5
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <CodeLink mapping={progressMappings["trigger-button"]}>
          <Button data-code-id="trigger-button">Start Task</Button>
        </CodeLink>
        <span className="text-sm text-muted-foreground">
          Click to start processing
        </span>
      </div>

      <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
        <p className="text-sm text-muted-foreground">
          Progress updates will appear here once connected to Trigger.dev
        </p>
        <div className="text-xs text-muted-foreground space-x-4">
          <CodeLink mapping={progressMappings["progress-stream"]}>
            <span
              className="underline decoration-dotted underline-offset-4"
              data-code-id="progress-stream"
            >
              View stream definition
            </span>
          </CodeLink>
          <CodeLink mapping={progressMappings["stream-write"]}>
            <span
              className="underline decoration-dotted underline-offset-4"
              data-code-id="stream-write"
            >
              View stream.write()
            </span>
          </CodeLink>
        </div>
      </div>
    </div>
  )
}
