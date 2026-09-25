import { LiveStatusCopy, TaskCard } from "@/components/dashboard-cards"
import { startedOn } from "@/src/domain/job-status-copy"
import type { LaunchedTaskCard } from "@/src/domain/launched-agents"
import { DashboardBackLink } from "@/components/dashboard-tabs"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
type AgentJob = LaunchedTaskCard

function stockLabel(job: AgentJob) {
  if (job.symbols?.length) {
    return job.symbols
      .map((row) =>
        row.name && row.symbol ? `${row.name} (${row.symbol})` : row.symbol
      )
      .filter(Boolean)
      .join(", ")
  }
  if (!job.symbol) return ""
  return job.companyName ? `${job.companyName} (${job.symbol})` : job.symbol
}

function categoryLabel(job: AgentJob) {
  if (job.category === "crypto") return "Crypto"
  if (job.category === "stocks") return "Stocks"
  return ""
}

export function LaunchedAgentDesk({
  name,
  tasks,
}: {
  name: string
  tasks: AgentJob[]
}) {
  const latest = tasks[0]
  const oldest = tasks[tasks.length - 1]
  const stocks = latest ? stockLabel(latest) : ""
  const category = latest ? categoryLabel(latest) : ""

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-4 md:p-6">
      <DashboardBackLink href="/dashboard" label="Dashboard" />

      <section className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium">Agent</p>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Who this agent is and what it is working on.
          </p>
        </div>
        <Card className="@container/card from-primary/5 to-card bg-linear-to-t shadow-xs dark:bg-card">
          <CardHeader>
            <CardDescription>
              {[category, stocks].filter(Boolean).join(" · ") || "Agent"}
            </CardDescription>
            <CardTitle className="font-heading text-3xl">{name}</CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-3 text-sm">
            <p className="font-medium">
              <LiveStatusCopy job={latest} name={name} />
            </p>
            {latest?.brief ? (
              <p className="text-muted-foreground max-w-2xl leading-relaxed">
                {latest.brief}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                {tasks.length === 1 ? "1 task" : `${tasks.length} tasks`}
              </Badge>
              {oldest?.createdAt ? (
                <Badge variant="outline">
                  Launched {startedOn(oldest.createdAt)}
                </Badge>
              ) : null}
            </div>
          </CardFooter>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium">Tasks</p>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Work this agent has done. Open a task to read the memo.
          </p>
        </div>
        {tasks.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No tasks yet</CardTitle>
              <CardDescription>
                Launch this agent again to run a task.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {tasks.map((job) => (
              <TaskCard key={String(job._id)} job={job} nested />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
