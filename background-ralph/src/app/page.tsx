import { RalphApp } from "@/components/ralph-app"
import { MobileWarning } from "@/components/mobile-warning"

export default function Home() {
  return (
    <>
      <MobileWarning />
      <main className="min-h-screen hidden md:block">
        <RalphApp />
      </main>
    </>
  )
}
