import { AgentRunner } from "@/components/agent-runner";

export default function Home() {
  return (
    <div className="min-h-screen bg-grid">
      <main className="max-w-5xl mx-auto px-6 md:px-10 pt-16 md:pt-24 pb-16">
        <header className="animate-fade-in-up [animation-delay:0.05s] mb-6">
          <h1 className="text-[28px] md:text-[34px] font-mono font-bold tracking-tight text-text">
            <span className="text-accent mr-2 relative -top-[2px]">&gt;</span>
            background cursor
          </h1>
          <p className="text-[11px] tracking-[0.2em] uppercase text-accent mt-3 font-mono">
            Powered by{" "}
            <a
              href="https://trigger.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent"
            >
              Trigger.dev
            </a>
          </p>
        </header>

        <div className="animate-fade-in-up [animation-delay:0.2s]">
          <AgentRunner />
        </div>
      </main>
    </div>
  );
}
