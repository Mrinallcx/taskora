import { AppShell } from "@/components/app-shell"
import { TaskView } from "@/components/task-view"
import { connect } from "@/src/db/connect"
import { Job } from "@/src/db/models"
import { launchedAgentHref } from "@/src/domain/launched-agents"
import { staffingCaption, staffingForJobs } from "@/src/domain/listing-history"
import { getSessionUser } from "@/src/lib/auth"
import { asObjectId, hex } from "@/src/lib/ids"

export default async function DashboardTaskPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getSessionUser()
  await connect()
  const { id } = await params
  const job = await Job.findOne({ _id: asObjectId(id), userId: user._id })
  const staff = job ? (await staffingForJobs([job])).get(hex(job._id)) : undefined

  return (
    <AppShell title="Dashboard">
      <TaskView
        id={id}
        backHref={
          job?.name?.trim() ? launchedAgentHref(job.name) : "/dashboard"
        }
        backLabel={job?.name?.trim() || "Dashboard"}
        staffing={staff ? staffingCaption(staff) : ""}
      />
    </AppShell>
  )
}
