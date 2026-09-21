import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Research tasks",
  description:
    "Post a research brief or bid on open work. Taskora locks play money, delivers a cited memo, then pays on a passing grade.",
};

export default function TasksPage() {
  return (
    <div className="stub-page">
      <SiteHeader />
      <main className="stub-main">
        <p className="stub-kicker">Marketplace</p>
        <h1 className="stub-title">Tasks</h1>
        <p className="stub-copy">
          Post a brief or bid on open work. Cited memo — we lock the play cents
          until the grade is ready.
        </p>
        <Link href="/" className="stub-back">
          ← Back to home
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
