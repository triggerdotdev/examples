"use client";

import { myTask } from "./api/actions";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <button
        onClick={async () => {
          await myTask();
        }}
      >
        Trigger my task
      </button>
    </main>
  );
}
