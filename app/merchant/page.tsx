import { AppShell } from "@/components/app-shell"
import { MerchantRegisterForm } from "@/components/merchant-register-form"
import { Card, CardContent } from "@/components/ui/card"
import { requireUserId } from "@/lib/require-user"

export default async function MerchantPage() {
  await requireUserId()
  return (
    <AppShell title="Merchant">
      <div className="flex flex-col gap-3 p-4 md:p-6">
        <Card size="sm" className="mx-auto w-full max-w-xl">
          <CardContent className="pt-(--card-spacing)">
            <MerchantRegisterForm />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
