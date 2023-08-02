import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TriggerProvider } from "@trigger.dev/react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OpenAI Article Summarizer",
  description: "Using Trigger.dev",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <TriggerProvider
          publicApiKey={process.env.NEXT_PUBLIC_CLIENT_TRIGGER_API_KEY ?? ""}
          apiUrl={process.env.NEXT_PUBLIC_TRIGGER_API_URL}
        >
          {children}
        </TriggerProvider>
      </body>
    </html>
  );
}
