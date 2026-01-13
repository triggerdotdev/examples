import { Suspense } from "react"
import { RalphApp } from "@/components/ralph-app"
import { MobileWarning } from "@/components/mobile-warning"

export default function Home() {
  return (
    <>
      <MobileWarning />
      <main className="min-h-screen hidden md:block">
        <Suspense fallback={<div className="h-screen flex items-center justify-center text-muted-foreground">Loading...</div>}>
          <RalphApp />
        </Suspense>
      </main>
    </>
  )
}
