import { getPublicToken } from "@/app/actions"
import { RunViewer } from "@/components/run-viewer"

type Props = {
  params: Promise<{ runId: string }>
}

export default async function RunPage({ params }: Props) {
  const { runId } = await params

  const result = await getPublicToken(runId)

  if (!result.ok) {
    return (
      <main className="min-h-screen p-8">
        <h1 className="text-2xl font-bold mb-4">Run: {runId}</h1>
        <p className="text-red-600">{result.error}</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Run: {runId}</h1>
      <RunViewer runId={runId} accessToken={result.value.token} />
    </main>
  )
}
