type Props = {
  params: Promise<{ runId: string }>
}

export default async function RunPage({ params }: Props) {
  const { runId } = await params

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">Run: {runId}</h1>
      <p className="text-gray-600">Realtime status will appear here in US-006/US-009.</p>
    </main>
  )
}
