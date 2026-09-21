import Link from "next/link"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { listingKindLabel } from "@/src/domain/listing-defaults"
import { parseSkills } from "@/src/domain/skills"

const listingCardClass =
  "@container/card from-primary/5 to-card h-full bg-linear-to-t shadow-xs dark:bg-card"

export function ListingCard({
  listing,
  href,
  footer,
  meta,
  action,
}: {
  listing: {
    _id: unknown
    kind: string
    name?: string
    slug: string
    summary?: string
    skills?: string
    priceCents?: number
  }
  href?: string
  footer?: string
  meta?: string
  action?: ReactNode
}) {
  const skills = parseSkills(listing.skills)
  const card = (
    <Card size="sm" className={listingCardClass}>
      <CardHeader>
        <CardDescription className="capitalize">
          {listingKindLabel(listing.kind)}
        </CardDescription>
        <CardTitle className="font-sans line-clamp-2 text-base font-medium leading-snug">
          {listing.name || listing.slug}
        </CardTitle>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardFooter className="flex-col items-start gap-2 py-2 text-sm">
        <span className="text-muted-foreground line-clamp-2">
          {listing.summary || footer || "Published listing"}
        </span>
        {meta ? (
          <span className="text-foreground line-clamp-2 font-medium">{meta}</span>
        ) : null}
        {skills.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {skills.slice(0, 4).map((skill) => (
              <Badge key={skill} variant="outline">
                {skill}
              </Badge>
            ))}
          </div>
        ) : null}
      </CardFooter>
    </Card>
  )
  if (!href) return <div className="min-w-0">{card}</div>
  return (
    <Link href={href} className="min-w-0">
      {card}
    </Link>
  )
}

export function statusCopy(status: string) {
  if (["delivered", "settled"].includes(status)) return "Memo ready"
  if (status === "cancelled") return "Run stopped"
  if (["in_progress", "evaluating", "revision"].includes(status)) {
    return "Agent is working"
  }
  if (status === "plan_review") return "Plan needs approval"
  if (status === "disputed") return "Under dispute"
  return "Waiting to start"
}

export function startedOn(value: Date | undefined) {
  if (!value) return "Opened from Launch Agent"
  return value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function TaskCard({
  job,
  href,
  action,
  staffing,
}: {
  job: {
    _id: unknown
    domain: string
    brief: string
    status: string
    createdAt?: Date
  }
  href?: string | null
  action?: ReactNode
  staffing?: string
}) {
  const card = (
    <Card size="sm" className={listingCardClass}>
      <CardHeader>
        <CardDescription className="capitalize">{job.domain}</CardDescription>
        <CardTitle className="font-sans line-clamp-2 text-base font-medium leading-snug">
          {job.brief}
        </CardTitle>
        <CardAction>
          {action ?? (
            <Badge variant="outline" className="capitalize">
              {job.status.replaceAll("_", " ")}
            </Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 py-2 text-sm">
        {staffing ? (
          <span className="text-foreground line-clamp-2 font-medium">{staffing}</span>
        ) : null}
        <div className="flex w-full justify-between gap-2">
          <span className="font-medium">{statusCopy(job.status)}</span>
          <span className="text-muted-foreground">{startedOn(job.createdAt)}</span>
        </div>
      </CardFooter>
    </Card>
  )
  if (href === null) return <div className="min-w-0">{card}</div>
  return (
    <Link href={href ?? `/dashboard/${String(job._id)}`} className="min-w-0">
      {card}
    </Link>
  )
}
