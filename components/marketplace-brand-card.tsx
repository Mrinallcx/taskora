import Link from "next/link"

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export type MarketplaceBrand = {
  slug: string
  name: string
  tagline?: string
  logo?: string
  agentCount: number
}

export function MarketplaceBrandCard({ brand }: { brand: MarketplaceBrand }) {
  return (
    <Link href={`/marketplace/brands/${brand.slug}`} className="min-w-0">
      <Card
        size="sm"
        className="@container/card from-primary/5 to-card h-full bg-linear-to-t shadow-xs dark:bg-card"
      >
        <CardHeader>
          <div className="flex items-center gap-3">
            {brand.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logo}
                alt=""
                className="size-10 shrink-0 rounded-lg object-contain ring-1 ring-border"
              />
            ) : (
              <div className="bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold">
                {brand.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <CardDescription>Brand</CardDescription>
              <CardTitle className="font-sans line-clamp-1 text-base font-medium leading-snug">
                {brand.name}
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 py-2 text-sm">
          <span className="text-muted-foreground line-clamp-2">
            {brand.tagline || "Published brand"}
          </span>
          <span className="text-foreground text-xs font-medium">
            {brand.agentCount === 1
              ? "1 public agent"
              : `${brand.agentCount} public agents`}
          </span>
        </CardFooter>
      </Card>
    </Link>
  )
}
