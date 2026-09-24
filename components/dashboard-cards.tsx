"use client"

import Link from "next/link"
import { useEffect, useState, type ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ResearchOrb } from "@/components/research-orb"
import { listingKindLabel } from "@/src/domain/listing-defaults"
import { startedOn, statusCopy } from "@/src/domain/job-status-copy"
import { isResearchingStatus } from "@/src/domain/research-orb"
import { parseSkills } from "@/src/domain/skills"

export { startedOn, statusCopy }

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

export function AgentCard({
  name,
  href,
  status,
  taskCount,
  symbols,
  jobId,
}: {
  name: string
  href: string
  status: string
  taskCount: number
  symbols?: string
  jobId?: unknown
}) {
  const live = useLiveJob({ _id: jobId ?? "", status })
  return (
    <Link href={href} className="min-w-0">
      <Card size="sm" className={listingCardClass}>
        <CardHeader>
          <CardDescription>{symbols || "Agent"}</CardDescription>
          <CardTitle className="font-heading line-clamp-2 text-2xl">
            {name}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {taskCount === 1 ? "1 task" : `${taskCount} tasks`}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="text-sm">
          <span className="font-medium">{statusCopy(live.status, name, live)}</span>
        </CardFooter>
      </Card>
    </Link>
  )
}

function useLiveJob(job: {
  _id: unknown
  status: string
  workerId?: string
  workerQueued?: boolean
}) {
  const [live, setLive] = useState({
    status: job.status,
    workerId: job.workerId,
    workerQueued: job.workerQueued,
  })

  useEffect(() => {
    setLive({
      status: job.status,
      workerId: job.workerId,
      workerQueued: job.workerQueued,
    })
  }, [job.status, job.workerId, job.workerQueued])

  useEffect(() => {
    if (!isResearchingStatus(live.status)) return
    const id = String(job._id)
    if (!id || id === "undefined") return
    let cancelled = false
    const load = async () => {
      const response = await fetch(`/api/jobs/${id}`)
      if (!response.ok || cancelled) return
      const payload = (await response.json()) as {
        job?: { status?: string; workerId?: string; workerQueued?: boolean }
      }
      if (!payload.job?.status || cancelled) return
      setLive({
        status: payload.job.status,
        workerId: payload.job.workerId,
        workerQueued: payload.job.workerQueued,
      })
    }
    void load()
    const timer = window.setInterval(() => void load(), 2000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [job._id, live.status])

  return live
}

export function LiveStatusCopy({
  job,
  name,
}: {
  job?: {
    _id: unknown
    status: string
    workerId?: string
    workerQueued?: boolean
  }
  name?: string
}) {
  const live = useLiveJob(job ?? { _id: "", status: "" })
  return <>{statusCopy(live.status || job?.status || "", name, live)}</>
}

export function TaskCard({
  job,
  href,
  action,
  staffing,
  nested,
}: {
  job: {
    _id: unknown
    name?: string
    domain: string
    brief: string
    status: string
    createdAt?: Date | string
    symbol?: string
    companyName?: string
    symbols?: { symbol?: string; name?: string }[]
    workerId?: string
    workerQueued?: boolean
  }
  href?: string | null
  action?: ReactNode
  staffing?: string
  nested?: boolean
}) {
  const live = useLiveJob(job)
  const title = nested ? job.brief : job.name?.trim() || job.brief
  const card = (
    <Card size="sm" className={listingCardClass}>
      <CardHeader>
        <CardDescription className="capitalize">
          {job.symbols?.length
            ? job.symbols
                .map((row) => row.symbol)
                .filter(Boolean)
                .join(" · ")
            : job.symbol
              ? `${job.symbol}${job.companyName ? ` · ${job.companyName}` : ""}`
              : nested
                ? "Task"
                : job.name
                  ? "Agent"
                  : job.domain}
        </CardDescription>
        <CardTitle className="font-sans line-clamp-2 text-base font-medium leading-snug">
          {title}
        </CardTitle>
        <CardAction>
          {action ?? (
            <Badge variant="outline" className="capitalize">
              {live.status.replaceAll("_", " ")}
            </Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 py-2 text-sm">
        {!nested && job.name?.trim() ? (
          <span className="text-muted-foreground line-clamp-2">{job.brief}</span>
        ) : null}
        {staffing ? (
          <span className="text-foreground line-clamp-2 font-medium">{staffing}</span>
        ) : null}
        <div className="flex w-full items-center justify-between gap-2">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            {isResearchingStatus(live.status) ? (
              <ResearchOrb startedAt={job.createdAt} />
            ) : null}
            <span className="font-medium">
              {statusCopy(live.status, job.name, live)}
            </span>
          </span>
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
