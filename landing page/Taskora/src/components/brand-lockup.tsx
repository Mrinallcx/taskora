import Link from "next/link";

type BrandLockupProps = {
  size?: "header" | "footer" | "sidebar";
  onClick?: () => void;
};

export function BrandLockup({ size = "header", onClick }: BrandLockupProps) {
  return (
    <Link
      href="/"
      className={`brand-lockup brand-lockup--${size}`}
      aria-label="Taskora by LCX, go to homepage"
      onClick={onClick}
    >
      <img src="/logo.png" alt="" width={48} height={66} />
      <span className="brand-lockup-text">
        <span className="brand-lockup-name">Taskora</span>
        <span className="brand-lockup-by">
          by <span>LCX</span>
        </span>
      </span>
    </Link>
  );
}
