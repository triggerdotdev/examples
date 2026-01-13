import { RalphApp } from "@/components/ralph-app"

export default function Home() {
  return (
    <main className="min-h-screen py-16 px-6 flex flex-col items-center">
      <div className="mb-12 text-center">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground">
          Background Ralph
        </h1>
        <p className="text-[14px] text-muted-foreground mt-2">
          Autonomous Claude Code agent
        </p>
      </div>
      <RalphApp />
    </main>
  )
}
