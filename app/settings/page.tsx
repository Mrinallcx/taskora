import { AppShell } from "@/components/app-shell"
import { SettingsPage } from "@/components/settings-page"
import { requireUserId } from "@/lib/require-user"

export default async function SettingsRoute() {
  await requireUserId()
  return (
    <AppShell title="Settings">
      <SettingsPage />
    </AppShell>
  )
}
