"use client";

import { TriggerAuthContext } from "@trigger.dev/react-hooks";
import { ReactNode } from "react";

export function TriggerProvider({
  accessToken,
  children,
}: {
  accessToken: string;
  children: ReactNode;
}) {
  return (
    <TriggerAuthContext.Provider value={{ accessToken }}>
      {children}
    </TriggerAuthContext.Provider>
  );
}
