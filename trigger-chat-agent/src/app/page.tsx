"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Send visitors to a fresh chat URL, but REPLACE the history entry so "/" is
// never left in the back stack. A server redirect here re-mints a new chat on
// every back-navigation to "/" (the "back button makes a new chat" bug) and
// spawns a session on every visit; replacing avoids both.
export default function Home() {
  const router = useRouter();
  const redirected = useRef(false);

  useEffect(() => {
    if (redirected.current) return;
    redirected.current = true;
    router.replace(`/c/${crypto.randomUUID()}`);
  }, [router]);

  return null;
}
