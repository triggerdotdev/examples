import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/sidebar";
import { isPersistenceEnabled } from "@/lib/db";
import { listChats } from "@/lib/db/queries";
import { getUserId } from "@/lib/user";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Trigger.dev chat agent",
  description:
    "A Trigger.dev chat agent that teaches you Trigger.dev by drawing — interactive diagrams and code cards, not walls of text.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // With no DATABASE_URL there's no history to show, so the sidebar is simply
  // absent and the app is a single-conversation demo.
  const userId = isPersistenceEnabled ? await getUserId() : null;
  const chats = userId ? await listChats(userId) : [];

  return (
    <html lang="en" className="dark">
      <head>
        {/* Satoshi (used for card/heading titles via `font-title`) — free Fontshare CDN. */}
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@700,500,400&display=swap"
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <div className="flex h-dvh">
          {isPersistenceEnabled && <Sidebar chats={chats} />}
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </body>
    </html>
  );
}
