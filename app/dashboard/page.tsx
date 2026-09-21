import Link from "next/link"

import { DashboardTabs } from "@/components/dashboard-tabs"
import { ListingCard, TaskCard } from "@/components/dashboard-cards"
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
import {
  dashboardCatalog,
  staffingCaption,
  staffingForJobs,
} from "@/src/domain/listing-history"
import { getSessionUser } from "@/src/lib/auth"
import { hex } from "@/src/lib/ids"

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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const user = await getSessionUser()
  await connect()
  const { tab: tabParam } = await searchParams
  const tab =
    tabParam === "agents" || tabParam === "workers" || tabParam === "tasks"
      ? tabParam
      : "tasks"
  const ownerUserId = hex(user._id)
  const tasks = await Job.find({ userId: user._id }).sort({ createdAt: -1 })
  const [{ agents, workers }, staffing] = await Promise.all([
    dashboardCatalog(ownerUserId, tasks),
    staffingForJobs(tasks),
  ])
  const lastHireByAgent = new Map<string, string>()
  const lastTaskByWorker = new Map<string, string>()
  for (const job of tasks) {
    const staff = staffing.get(hex(job._id))
    if (!staff) continue
    if (staff.agentId && staff.workerNames.length && !lastHireByAgent.has(staff.agentId)) {
      lastHireByAgent.set(
        staff.agentId,
        `Last hired ${staff.workerNames.join(", ")}`
      )
    }
    for (const workerId of staff.workerIds ?? []) {
      if (lastTaskByWorker.has(workerId)) continue
      lastTaskByWorker.set(
        workerId,
        staff.agentName
          ? `Ran latest task for ${staff.agentName}`
          : "Ran your latest task"
      )
    }
  }

  return (
    <AppShell title="Dashboard">
      <div className="flex w-full flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DashboardTabs active={tab} />
          <Button
            size="sm"
            nativeButton={false}
            render={
              <Link href="/launch-agent" />
            }
          >
            Launch research
          </Button>
        </div>

        {tab === "agents" ? (
          agents.length === 0 ? (
            <EmptyState
              title="No agents yet"
              hint="Publish an agent, or hire one from Marketplace. Open it to see its workers and the tasks it has run."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {agents.map((listing) => (
                <ListingCard
                  key={hex(listing._id)}
                  listing={listing}
                  href={`/dashboard/agents/${hex(listing._id)}`}
                  meta={lastHireByAgent.get(hex(listing._id))}
                />
              ))}
            </div>
          )
        ) : null}

        {tab === "workers" ? (
          workers.length === 0 ? (
            <EmptyState
              title="No workers yet"
              hint="Workers appear here when you publish them, or when an agent assigns them to your tasks."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {workers.map((listing) => (
                <ListingCard
                  key={hex(listing._id)}
                  listing={listing}
                  href={`/dashboard/workers/${hex(listing._id)}`}
                  meta={lastTaskByWorker.get(hex(listing._id))}
                />
              ))}
            </div>
          )
        ) : null}

        {tab === "tasks" ? (
          tasks.length === 0 ? (
            <EmptyState
              title="No tasks yet"
              hint="Launch research from Launch Agent. Each card is a job on your dashboard."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {tasks.map((job) => (
                <TaskCard
                  key={hex(job._id)}
                  job={job}
                  staffing={staffingCaption(
                    staffing.get(hex(job._id)) ?? { workerNames: [] }
                  )}
                />
              ))}
            </div>
          )
        ) : null}
      </div>
    </AppShell>
  )
}
