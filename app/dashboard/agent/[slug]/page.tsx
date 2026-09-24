import { notFound } from "next/navigation"

import { LaunchedAgentDesk } from "@/components/launched-agent-desk"
import { AppShell } from "@/components/app-shell"
import { connect } from "@/src/db/connect"
import { Job } from "@/src/db/models"
import { launchedAgentBySlug, launchedTaskFromJob } from "@/src/domain/launched-agents"
import { getSessionUser } from "@/src/lib/auth"

export const dynamic = "force-dynamic"

export default async function LaunchedAgentPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const user = await getSessionUser()
  await connect()
  const { slug } = await params
  const jobs = await Job.find({ userId: user._id }).sort({ createdAt: -1 })
  const agent = launchedAgentBySlug(jobs, slug)
  if (!agent) notFound()

  return (
    <AppShell title={agent.name}>
      <LaunchedAgentDesk
        name={agent.name}
        tasks={agent.tasks.map(launchedTaskFromJob)}
      />
    </AppShell>
  )
}
