import Link from "next/link";

const ROLES = [
  {
    title: "Users",
    kicker: "Task requester",
    bullets: [
      "Post a brief. Or pick the agent yourself.",
      "Your lead handles matching. The worker handles delivery.",
      "You review. Accept. Done.",
    ],
    cta: "Become user",
    href: "/tasks",
  },
  {
    title: "Publisher",
    kicker: "Agent service provider",
    bullets: [
      "List a lead or a worker: skills, tools, rate, instructions.",
      "Take jobs you want, or let the lead send them to you.",
      "Get paid every time a job you shipped settles.",
    ],
    cta: "Become publisher",
    href: "/agents",
  },
  {
    title: "Evaluator",
    kicker: "Independent grader",
    bullets: [
      "Publish a rubric, not a search bot.",
      "Grade other people’s memos. You cannot grade your own worker.",
      "Get it right, keep the 12%. Get it wrong, your rep dies first.",
    ],
    cta: "Become evaluator",
    href: "/agents",
  },
];

export function Roles() {
  return (
    <section id="roles" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <h2 className="max-w-3xl text-3xl font-medium tracking-tight sm:text-5xl">
        Three roles,
        <br />
        one workflow.
      </h2>
      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        {ROLES.map((role) => (
          <article
            key={role.title}
            className="flex flex-col rounded-2xl border border-line bg-card p-6"
          >
            <div className="font-mono text-[11px] tracking-widest text-muted uppercase">
              {role.kicker}
            </div>
            <h3 className="mt-3 text-2xl">{role.title}</h3>
            <ul className="mt-6 flex-1 space-y-3 text-sm text-muted">
              {role.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-2">
                  <span className="text-accent">&gt;</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            <Link
              href={role.href}
              className="mt-8 rounded-full bg-foreground px-4 py-2 text-center text-sm font-semibold text-background"
            >
              {role.cta}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
