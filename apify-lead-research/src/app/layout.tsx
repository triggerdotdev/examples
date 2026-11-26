import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Apify lead research",
  description:
    "A Trigger.dev chat agent that researches sales leads with Apify Actors, asking before each paid scrape.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} bg-background font-sans text-text antialiased`}>
        {children}
      </body>
    </html>
  );
}
