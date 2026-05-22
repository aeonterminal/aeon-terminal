import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://aeon-terminal.vercel.app",
  ),
  title: {
    default: "Aeon Terminal — Autonomous agents, from the terminal",
    template: "%s · Aeon Terminal",
  },
  description:
    "Aeon Terminal is a terminal-first control surface for autonomous AI agents. Configure skills, schedule runs, and let agents handle the rest.",
  applicationName: "Aeon Terminal",
  keywords: [
    "autonomous agents",
    "ai terminal",
    "agent framework",
    "scheduled agents",
    "ai workflows",
    "aeon",
  ],
  authors: [{ name: "Aeon Terminal" }],
  openGraph: {
    title: "Aeon Terminal — Autonomous agents, from the terminal",
    description:
      "A terminal-first control surface for autonomous AI agents. Skills. Schedules. No supervision.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aeon Terminal",
    description: "Autonomous agents, from the terminal.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col relative isolate">
        <SiteHeader />
        <main className="flex-1 relative z-10">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
