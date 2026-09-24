import Link from "next/link"
import { notFound } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { DashboardBackLink } from "@/components/dashboard-tabs"
import { MarketplaceListingCard } from "@/components/marketplace-cards"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { connect } from "@/src/db/connect"
import { Listing, Merchant } from "@/src/db/models"
import { getSessionUser } from "@/src/lib/auth"
import { hex } from "@/src/lib/ids"

export const dynamic = "force-dynamic"

function EmptyCard({
  title,
  hint,
}: {
  title: string
  hint: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
    </Card>
  )
}

export default async function MarketplaceBrandPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const user = await getSessionUser()
  await connect()
  const { slug } = await params
  const merchant = await Merchant.findOne({ slug })
  if (!merchant) notFound()
  const owned = merchant.ownerUserId === hex(user._id)
  if (merchant.status !== "live" && !owned) notFound()
  if (!merchant.isPublic && !owned) notFound()

  const agents = await Listing.find({
    ownerUserId: merchant.ownerUserId,
    kind: "lead",
    status: "live",
    underMerchant: true,
  }).sort({ createdAt: -1 })

  return (
    <AppShell title={merchant.name}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DashboardBackLink href="/marketplace" label="Marketplace" />
          {owned ? (
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href="/merchant" />}
            >
              Edit brand
            </Button>
          ) : null}
        </div>
        <div className="flex items-start gap-4">
          {merchant.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={merchant.logo}
              alt=""
              className="size-16 shrink-0 rounded-xl object-contain ring-1 ring-border"
            />
          ) : (
            <div className="bg-muted text-foreground flex size-16 shrink-0 items-center justify-center rounded-xl text-lg font-semibold">
              {merchant.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-muted-foreground text-sm">Brand</p>
            <h2 className="font-heading mt-1 text-3xl">{merchant.name}</h2>
            {merchant.tagline ? (
              <p className="text-muted-foreground mt-2 text-sm">
                {merchant.tagline}
              </p>
            ) : null}
            {merchant.about ? (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed">
                {merchant.about}
              </p>
            ) : null}
            {merchant.website ? (
              <a
                href={merchant.website}
                target="_blank"
                rel="noreferrer"
                className="text-primary mt-3 inline-block text-sm underline-offset-4 hover:underline"
              >
                Website
              </a>
            ) : null}
          </div>
        </div>

        <section>
          <p className="mb-3 text-sm font-medium">Agents</p>
          {agents.length === 0 ? (
            <EmptyCard
              title="No agents under this brand"
              hint={
                owned
                  ? "Launch an Agent and turn on Publish under your organization."
                  : "This brand has not listed an agent yet."
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        </section>
      </div>
    </AppShell>
  )
}
