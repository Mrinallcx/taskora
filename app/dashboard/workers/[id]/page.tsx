import { notFound } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { TaskCard } from "@/components/dashboard-cards"
import { DashboardBackLink } from "@/components/dashboard-tabs"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { connect } from "@/src/db/connect"
import { Listing } from "@/src/db/models"
import { jobsForWorker, staffingCaption, staffingForJobs } from "@/src/domain/listing-history"
import { parseSkills } from "@/src/domain/skills"
import { getSessionUser } from "@/src/lib/auth"
import { asObjectId, hex } from "@/src/lib/ids"

export const dynamic = "force-dynamic"

export default async function DashboardWorkerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getSessionUser()
  await connect()
  const { id } = await params
  const listing = await Listing.findOne({
    _id: asObjectId(id),
    kind: "worker",
  })
  if (!listing) notFound()
  const owned = listing.ownerUserId === hex(user._id)
  const tasks = await jobsForWorker(id, user._id)
  if (!owned && tasks.length === 0) notFound()
  const staffing = await staffingForJobs(tasks)
  const skills = parseSkills(listing.skills)
  const latest = tasks[0]
  const earlier = tasks.slice(1)

  return (
    <AppShell title="Worker">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
        <DashboardBackLink href="/dashboard?tab=workers" label="Your Workers" />
        <div>
          <p className="text-muted-foreground text-sm capitalize">{listing.kind}</p>
          <h2 className="font-heading mt-1 text-2xl">{listing.name || listing.slug}</h2>
          {listing.summary ? (
            <p className="text-muted-foreground mt-2 text-sm">{listing.summary}</p>
          ) : null}
          {skills.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1">
              {skills.map((skill) => (
                <Badge key={skill} variant="outline">
                  {skill}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <p className="mb-3 text-sm font-medium">Latest task</p>
          {latest ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <TaskCard
                job={latest}
                staffing={staffingCaption(
                  staffing.get(hex(latest._id)) ?? { workerNames: [] }
                )}
              />
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No tasks yet</CardTitle>
                <CardDescription>
                  Jobs this worker ran will show here. Click a task to see the memo.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
        {earlier.length > 0 ? (
          <div>
            <p className="mb-3 text-sm font-medium">Earlier tasks</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {earlier.map((job) => (
                <TaskCard
                  key={hex(job._id)}
                  job={job}
                  staffing={staffingCaption(
                    staffing.get(hex(job._id)) ?? { workerNames: [] }
                  )}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}
