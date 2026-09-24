import Link from "next/link"
import { redirect } from "next/navigation"

import { AgentCard } from "@/components/dashboard-cards"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { connect } from "@/src/db/connect"
import { Job } from "@/src/db/models"
import { groupLaunchedAgents, launchedAgentHref } from "@/src/domain/launched-agents"
import { getSessionUser } from "@/src/lib/auth"

export const dynamic = "force-dynamic"

function EmptyState({
  title,
  hint,
}: {
  title: string
  hint: string
}) {
  return (
    <Card className="@container/card from-primary/5 to-card bg-linear-to-t shadow-xs dark:bg-card">
      <CardHeader>
        <CardDescription>Dashboard</CardDescription>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="text-muted-foreground">{hint}</div>
      </CardFooter>
    </Card>
  )
}

function symbolLabel(job: {
  symbol?: string
  symbols?: { symbol?: string }[]
}) {
  if (job.symbols?.length) {
    return job.symbols
      .map((row) => row.symbol)
      .filter(Boolean)
      .join(" · ")
  }
  return job.symbol || ""
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const user = await getSessionUser()
  await connect()
  const { tab: tabParam } = await searchParams
  if (tabParam) redirect("/dashboard")
  const jobs = await Job.find({ userId: user._id }).sort({ createdAt: -1 })
  const agents = groupLaunchedAgents(jobs)

  return (
    <AppShell title="Dashboard">
      <div className="flex w-full flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href="/launch-agent" />}
          >
            Launch agent
          </Button>
        </div>

        {agents.length === 0 ? (
          <EmptyState
            title="No agents yet"
            hint="Launch an agent. Named runs show up here. Open one to see its tasks."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {agents.map((agent) => {
              const latest = agent.tasks[0]
              return (
                <AgentCard
                  key={agent.slug}
                  name={agent.name}
                  href={launchedAgentHref(agent.name)}
                  status={latest.status}
                  taskCount={agent.tasks.length}
                  symbols={symbolLabel(latest)}
                  jobId={String(latest._id)}
                />
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
