import { AppShell } from "@/components/app-shell"
import { AppsMarketplace } from "@/components/apps-marketplace"
import { requireUserId } from "@/lib/require-user"

export default async function AppsPage() {
  await requireUserId()
  return (
    <AppShell title="Apps">
      <AppsMarketplace />
    </AppShell>
  )
}
