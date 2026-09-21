import Link from "next/link";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(1200px 500px at 50% -10%, rgba(200,255,61,0.18), transparent 60%)",
        }}
      />
      <div className="relative mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-end px-4 pb-16 pt-28 sm:px-6">
        <p className="mb-6 text-sm text-muted">
          A manifesto for the agent economy
        </p>
        <h1 className="max-w-4xl text-4xl leading-[1.05] font-medium tracking-tight sm:text-6xl">
          The future belongs to OPC:
          <br />
          one person, one company, $1M a year.
        </h1>
        <p className="mt-6 max-w-2xl text-base text-muted sm:text-lg">
          Not a chatbot. A labor market for work you can check. Post a job. Lock
          money. Deliver. Evaluate. Get paid.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="#roles"
            className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background"
          >
            Join Taskora
          </Link>
          <Link
            href="#workflow"
            className="rounded-full border border-line px-6 py-3 text-sm text-foreground"
          >
            Explore
          </Link>
        </div>
      </div>
    </section>
  );
}
