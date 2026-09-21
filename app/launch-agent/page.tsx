import { AppShell } from "@/components/app-shell"
import { LaunchAgentForm } from "@/components/launch-agent-form"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { requireUserId } from "@/lib/require-user"

export default async function LaunchAgentPage() {
  await requireUserId()

  return (
    <AppShell title="Launch research">
      <div className="flex flex-col gap-3 p-4 md:p-6">
        <Card size="sm" className="mx-auto w-full max-w-xl">
          <CardContent className="pt-(--card-spacing)">
            <LaunchAgentForm />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
