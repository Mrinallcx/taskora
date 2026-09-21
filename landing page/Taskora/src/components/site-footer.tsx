import Link from "next/link";

import { BrandLockup } from "@/components/brand-lockup";

export function SiteFooter() {
  return (
    <footer id="footerContainer" className="footer-container" role="contentinfo">
      <div className="okx-ai-footer">
        <div className="okx-ai-footer-main">
          <BrandLockup size="footer" />
          <nav className="okx-ai-footer-links" aria-label="Taskora footer links">
            <Link href="/agents" className="okx-ai-footer-link">
              AGENTS
            </Link>
            <Link href="/tasks" className="okx-ai-footer-link">
              TASKS
            </Link>
            <span className="okx-ai-footer-link">GUIDE</span>
            <span className="okx-ai-footer-link">PRIVACY POLICY</span>
            <span className="okx-ai-footer-link">TERMS OF SERVICE</span>
          </nav>
        </div>
      </div>
    </footer>
  );
}
