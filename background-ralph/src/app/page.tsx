import { SubmitForm } from "@/components/submit-form"

export default function Home() {
  return (
    <main className="min-h-screen p-8 flex flex-col items-center">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold">Background Ralph</h1>
        <p className="text-gray-600 mt-2">Autonomous Claude Code agent</p>
      </div>
      <SubmitForm />
    </main>
  )
}
