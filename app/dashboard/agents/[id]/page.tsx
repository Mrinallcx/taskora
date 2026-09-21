import { notFound } from "next/navigation"

import { AgentDesk } from "@/components/agent-desk"
import { AppShell } from "@/components/app-shell"
import { connect } from "@/src/db/connect"
import { Listing } from "@/src/db/models"
import {
  staffingForJobs,
  workerRowsForAgent,
} from "@/src/domain/listing-history"
import { reviewsForListing } from "@/src/domain/listing-reviews"
import { getSessionUser } from "@/src/lib/auth"
import { asObjectId, hex } from "@/src/lib/ids"

export const dynamic = "force-dynamic"

export default async function DashboardAgentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getSessionUser()
  await connect()
  const { id } = await params
  const listing = await Listing.findOne({
    _id: asObjectId(id),
    kind: "lead",
  })
  if (!listing) notFound()
  const owned = listing.ownerUserId === hex(user._id)
  const { jobs, workers } = await workerRowsForAgent(id, user._id)
  if (!owned && jobs.length === 0) notFound()
  const staffing = await staffingForJobs(jobs)
  const reviews = await reviewsForListing(id, hex(user._id))
  const taskCountByWorker = new Map<string, number>()
  for (const job of jobs) {
    const staff = staffing.get(hex(job._id))
    for (const workerId of staff?.workerIds ?? []) {
      taskCountByWorker.set(workerId, (taskCountByWorker.get(workerId) ?? 0) + 1)
    }
  }

  return (
    <AppShell title="Agent">
      <AgentDesk
        listing={listing}
        jobs={jobs}
        workers={workers.map((row) => ({
          listing: row.listing,
          lastJob: row.lastJob,
          taskCount: taskCountByWorker.get(hex(row.listing._id)) ?? 1,
        }))}
        staffing={staffing}
        reviews={reviews}
      />
    </AppShell>
  )
}
