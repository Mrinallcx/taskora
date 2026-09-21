"use client";

import Link from "next/link";
import { useState } from "react";

import { BrandLockup } from "@/components/brand-lockup";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header id="headerContainer" className="header header-container" data-chain="true">
      <div className="okx-ai-header-wrap">
        <div className="okx-ai-header-main okx-ai-shrink-step-0" data-from="5">
          <BrandLockup />
          <div className="okx-ai-header-right">
            <Link href="/#roles" className="okx-ai-join-btn">
              JOIN TASKORA (BETA)
            </Link>
            <button
              type="button"
              className="okx-ai-sidebar-btn"
              aria-label="Open menu with additional options"
              onClick={() => setOpen(true)}
            >
              <span className="okx-ai-burger" aria-hidden="true">
                ☰
              </span>
            </button>
          </div>
        </div>
      </div>
      <div
        className={`okx-ai-sidebar-overlay${open ? " is-visible" : ""}`}
        role="presentation"
        onClick={() => setOpen(false)}
      />
      <div
        className={`okx-ai-sidebar${open ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="okx-ai-sidebar-header">
          <BrandLockup size="sidebar" onClick={() => setOpen(false)} />
          <button
            type="button"
            className="okx-ai-sidebar-close"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </div>
        <nav className="okx-ai-sidebar-nav">
          <Link href="/" className="okx-ai-sidebar-nav-item" onClick={() => setOpen(false)}>
            Home
          </Link>
        </nav>
        <div className="okx-ai-sidebar-divider" />
        <div className="okx-ai-sidebar-bottom">
          <Link
            href="/#roles"
            className="okx-ai-sidebar-join-btn"
            onClick={() => setOpen(false)}
          >
            JOIN TASKORA (BETA)
          </Link>
        </div>
      </div>
    </header>
  );
}
