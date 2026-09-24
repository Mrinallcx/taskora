import Link from "next/link"
import { redirect } from "next/navigation"

import { MarketplaceListingCard } from "@/components/marketplace-cards"
import { MarketplaceBrandCard } from "@/components/marketplace-brand-card"
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
import { Listing, Merchant } from "@/src/db/models"
import { requireUserId } from "@/lib/require-user"
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
        <CardDescription>Marketplace</CardDescription>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="text-muted-foreground">{hint}</div>
      </CardFooter>
    </Card>
  )
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  await requireUserId()
  await connect()
  const { tab: tabParam } = await searchParams
  if (tabParam) redirect("/marketplace")

  const [agents, brands] = await Promise.all([
    Listing.find({ kind: "lead", status: "live", isPublic: true }).sort({
      createdAt: -1,
    }),
    Merchant.find({ status: "live", isPublic: true }).sort({ createdAt: -1 }),
  ])
  const agentCounts =
    brands.length === 0
      ? []
      : await Listing.aggregate<{ _id: string; n: number }>([
          {
            $match: {
              ownerUserId: { $in: brands.map((row) => row.ownerUserId) },
              kind: "lead",
              status: "live",
              underMerchant: true,
            },
          },
          { $group: { _id: "$ownerUserId", n: { $sum: 1 } } },
        ])
  const agentCountByOwner = new Map(
    agentCounts.map((row) => [row._id, row.n])
  )
  const empty = agents.length === 0 && brands.length === 0

  return (
    <AppShell title="Marketplace">
      <div className="flex w-full flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-2xl">Agents and Brands</h2>
            <p className="text-muted-foreground text-sm">
              Public agents and brands on the desk.
            </p>
          </div>
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href="/launch-agent" />}
          >
            Launch agent
          </Button>
        </div>

        {empty ? (
          <EmptyState
            title="Nothing listed yet"
            hint="Public agents and brands show up here."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {brands.map((brand) => (
              <MarketplaceBrandCard
                key={brand.slug}
                brand={{
                  slug: brand.slug,
                  name: brand.name,
                  tagline: brand.tagline,
                  logo: brand.logo,
                  agentCount: agentCountByOwner.get(brand.ownerUserId) ?? 0,
                }}
              />
            ))}
            {agents.map((listing) => (
              <MarketplaceListingCard
                key={hex(listing._id)}
                listing={{
                  _id: hex(listing._id),
                  kind: listing.kind,
                  name: listing.name,
                  slug: listing.slug,
                  summary: listing.summary,
                  skills: listing.skills,
                  priceCents: listing.priceCents,
                  tools: listing.tools,
                  defaultBrief: listing.defaultBrief,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
