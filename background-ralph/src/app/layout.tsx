import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Bangers } from "next/font/google"
import "./globals.css"

const bangers = Bangers({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
})

export const metadata: Metadata = {
  title: "Background Ralph",
  description: "Autonomous Claude Code agent running Ralph Wiggum loops",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${bangers.variable}`}>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
