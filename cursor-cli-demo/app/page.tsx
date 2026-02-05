import { AgentRunner } from "@/components/agent-runner";

export default function Home() {
  return (
    <main className="min-h-screen p-6 md:p-10 max-w-4xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold font-[family-name:var(--font-geist-mono)]">
          Cursor Agent Runner
        </h1>
        <p className="text-xs text-white/30 mt-1">
          Powered by Trigger.dev — watch an AI agent generate code in real time
        </p>
      </div>

      <AgentRunner />
    </main>
  );
}
