"use client";

import { TriggerProvider } from "@trigger.dev/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TriggerProvider
      publicApiKey={process.env.NEXT_PUBLIC_TRIGGER_API_KEY ?? ""}
      apiUrl={process.env.NEXT_PUBLIC_TRIGGER_API_URL}
    >
      {children}
    </TriggerProvider>
  );
}
