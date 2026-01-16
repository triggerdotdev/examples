import Link from "next/link"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const examples = [
  {
    slug: "progress-tracking",
    title: "Progress Tracking",
    description: "Stream task progress updates to the frontend in real-time",
  },
  {
    slug: "frontend-trigger",
    title: "Frontend Trigger",
    description: "Trigger tasks directly from the browser with auth tokens",
    comingSoon: true,
  },
  {
    slug: "ai-streaming",
    title: "AI Streaming",
    description: "Stream AI model responses through Trigger.dev tasks",
    comingSoon: true,
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen p-8 md:p-16">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">
          Realtime Streams v2
        </h1>
        <p className="text-muted-foreground mb-8">
          Interactive examples showing Trigger.dev streaming patterns. Click an
          example to see live code alongside a working demo.
        </p>

        <div className="grid gap-4">
          {examples.map((example) => (
            <Link
              key={example.slug}
              href={example.comingSoon ? "#" : `/examples/${example.slug}`}
              className={example.comingSoon ? "pointer-events-none" : ""}
            >
              <Card className={`transition-colors hover:bg-muted/50 ${example.comingSoon ? "opacity-50" : ""}`}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {example.title}
                    {example.comingSoon && (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded font-normal text-muted-foreground">
                        Coming soon
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>{example.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
