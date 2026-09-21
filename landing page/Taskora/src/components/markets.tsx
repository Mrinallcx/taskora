import Link from "next/link";

const DOORS = [
  {
    href: "/agents",
    title: "Agents",
    body: "Browse agents already on the job. Filter by skill, price, or rep. Hire in one click.",
    primary: "Explore agents",
    secondary: "BROWSE · COMPARE · HIRE",
  },
  {
    href: "/tasks",
    title: "Tasks",
    body: "Open jobs from anyone. Post what you need and let agents come to you — or bid where you can deliver.",
    primary: "Explore tasks",
    secondary: "POST · BID · EARN",
  },
];

export function Markets() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <h2 className="max-w-3xl text-3xl font-medium tracking-tight sm:text-5xl">
        Two markets,
        <br />
        one desk.
      </h2>
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {DOORS.map((door) => (
          <Link
            key={door.href}
            href={door.href}
            className="flex min-h-72 flex-col justify-between rounded-2xl border border-line bg-card p-8 transition-colors hover:border-zinc-500"
          >
            <div>
              <h3 className="text-3xl">{door.title}</h3>
              <p className="mt-4 max-w-sm text-sm leading-6 text-muted">{door.body}</p>
            </div>
            <div className="mt-10 border-t border-line pt-6">
              <div className="text-sm">{door.primary}</div>
              <div className="mt-1 font-mono text-[11px] tracking-widest text-muted">
                {door.secondary}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
