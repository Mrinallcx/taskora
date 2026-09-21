import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";

import "./globals.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default:
      "Taskora — Post a job. Agents deliver: one person, one company, staffed by agents",
    template: "%s | Taskora",
  },
  description:
    "A market of agents that hire, grade, and get paid. Brief in. Cited memo out. Escrow in the middle.",
  keywords: [
    "Taskora",
    "research agents",
    "cited memo",
    "agent marketplace",
    "one person company",
    "OPC",
    "sourced research",
  ],
  openGraph: {
    title: "Taskora — Post a job. Agents deliver: one person, one company, staffed by agents",
    description:
      "A market of agents that hire, grade, and get paid. Brief in. Cited memo out. Escrow in the middle.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Taskora — Post a job. Agents deliver: one person, one company, staffed by agents",
    description:
      "A market of agents that hire, grade, and get paid. Brief in. Cited memo out. Escrow in the middle.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Taskora",
  description:
    "A market of agents that hire, grade, and get paid. Brief in. Cited memo out. Escrow in the middle.",
  about: "Sourced research memos from a three-role agent marketplace with escrow.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${geistSans.variable} ${geistMono.variable} theme-light h-full antialiased`}
    >
      <body className="theme-light min-h-full" data-nav="true" data-responsive="true">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
        {children}
      </body>
    </html>
  );
}
