"use client"

import { useRealtimeRun, useRealtimeStream } from "@trigger.dev/react-hooks"
import { statusStream, agentOutputStream } from "@/trigger/streams"
import type { ralphLoop } from "@/trigger/ralph-loop"

type Props = {
  runId: string
  accessToken: string
}

export function RunViewer({ runId, accessToken }: Props) {
  const { run, error: runError } = useRealtimeRun<typeof ralphLoop>(runId, {
    accessToken,
  })

  const { parts: statusParts } = useRealtimeStream(statusStream, runId, {
    accessToken,
  })

  const { parts: outputParts } = useRealtimeStream(agentOutputStream, runId, {
    accessToken,
  })

  if (runError) {
    return <div className="text-red-600">Error: {runError.message}</div>
  }

  const latestStatus = statusParts?.[statusParts.length - 1]
  const agentOutput = outputParts?.join("") ?? ""

  return (
    <div className="space-y-6">
      {/* Run status */}
      <div className="flex items-center gap-4">
        <div className="text-sm text-gray-500">
          Status: <span className="font-medium text-gray-900">{run?.status ?? "loading..."}</span>
        </div>
        {latestStatus && (
          <div className="text-sm">
            {latestStatus.type === "iteration" && (
              <span className="text-blue-600">Iteration {latestStatus.iteration}</span>
            )}
            {latestStatus.type === "cloning" && (
              <span className="text-yellow-600">Cloning repo...</span>
            )}
            {latestStatus.type === "working" && (
              <span className="text-blue-600">Agent working...</span>
            )}
            {latestStatus.type === "complete" && (
              <span className="text-green-600">Complete</span>
            )}
            {latestStatus.type === "error" && (
              <span className="text-red-600">{latestStatus.message}</span>
            )}
            {latestStatus.type === "pushed" && latestStatus.branchUrl && (
              <a
                href={latestStatus.branchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                View branch
              </a>
            )}
          </div>
        )}
      </div>

      {/* Agent output */}
      <div className="border rounded-lg bg-gray-950 p-4 min-h-[300px] max-h-[600px] overflow-auto">
        <pre className="text-sm text-gray-100 whitespace-pre-wrap font-mono">
          {agentOutput || "Waiting for agent output..."}
        </pre>
      </div>

      {/* Status history */}
      {statusParts && statusParts.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-500">Status history ({statusParts.length})</summary>
          <ul className="mt-2 space-y-1 text-gray-600">
            {statusParts.map((s, i) => (
              <li key={i}>
                <span className="font-mono text-xs">[{s.type}]</span> {s.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
