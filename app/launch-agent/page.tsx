import { AppShell } from "@/components/app-shell"
import { LaunchAgentForm } from "@/components/launch-agent-form"
import { requireUserId } from "@/lib/require-user"
import { Job, Merchant } from "@/src/db/models"
import { summarizeLaunchedAgents } from "@/src/domain/launched-agents"
import { getSessionUser } from "@/src/lib/auth"
import { hex } from "@/src/lib/ids"

export default async function LaunchAgentPage() {
  await requireUserId()
  const user = await getSessionUser()
  const [merchant, jobs] = await Promise.all([
    Merchant.findOne({
      ownerUserId: hex(user._id),
    }).select("name"),
    Job.find({ userId: user._id }).sort({ createdAt: -1 }),
  ])

  return (
    <AppShell title="Launch agent">
      <div className="mx-auto flex w-full max-w-xl flex-col p-4 md:p-8">
        <LaunchAgentForm
          merchant={merchant ? { name: merchant.name } : null}
          agents={summarizeLaunchedAgents(jobs)}
        />
      </div>
    </AppShell>
  )
}
