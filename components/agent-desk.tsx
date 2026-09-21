import Link from "next/link"

import { AgentReviews, AgentRatingSummary } from "@/components/agent-reviews"
import { statusCopy, TaskCard } from "@/components/dashboard-cards"
import { DashboardBackLink } from "@/components/dashboard-tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { staffingCaption, type JobStaffing } from "@/src/domain/listing-history"
import type { ListingReviewSummary } from "@/src/domain/listing-reviews"
import { parseSkills } from "@/src/domain/skills"

function idOf(value: unknown) {
  return String(value)
}

type AgentListing = {
  _id: unknown
  kind: string
  name?: string
  slug: string
  summary?: string
  skills?: string
}

type AgentJob = {
  _id: unknown
  domain: string
  brief: string
  status: string
  createdAt?: Date
}

type AgentWorker = {
  listing: AgentListing
  lastJob: AgentJob
  taskCount: number
}

function EmptyCard({ title, hint }: { title: string; hint: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
    </Card>
  )
}

export function AgentDesk({
  listing,
  jobs,
  workers,
  staffing,
  reviews,
}: {
  listing: AgentListing
  jobs: AgentJob[]
  workers: AgentWorker[]
  staffing: Map<string, JobStaffing>
  reviews: ListingReviewSummary
}) {
  const skills = parseSkills(listing.skills)
  const listingId = idOf(listing._id)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DashboardBackLink href="/dashboard?tab=agents" label="Your Agents" />
        <Button
          size="sm"
          nativeButton={false}
          render={<Link href="/launch-agent" />}
        >
          Launch research
        </Button>
      </div>

      <div>
        <p className="text-muted-foreground text-sm">Agent</p>
        <h2 className="font-heading mt-1 text-3xl">
          {listing.name || listing.slug}
        </h2>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
          {listing.summary ||
            "This agent plans the job and hires workers to write the memo."}
        </p>
        <p className="text-muted-foreground mt-3 text-sm">
          {workers.length} {workers.length === 1 ? "worker" : "workers"} ·{" "}
          {jobs.length} {jobs.length === 1 ? "task" : "tasks"}
        </p>
        <AgentRatingSummary average={reviews.average} count={reviews.count} />
        {skills.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1">
            {skills.map((skill) => (
              <Badge key={skill} variant="outline">
                {skill}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium">Workers</p>
          <p className="text-muted-foreground mt-0.5 text-sm">
            People this agent hired to do the writing.
          </p>
        </div>
        {workers.length === 0 ? (
          <EmptyCard
            title="No workers yet"
            hint={
              jobs.length > 0
                ? "A task is running. Workers show here once this agent assigns one."
                : "Run a task. This agent will hire a worker, and they will appear here."
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {workers.map(({ listing: worker, lastJob, taskCount }) => (
              <Link
                key={idOf(worker._id)}
                href={`/dashboard/workers/${idOf(worker._id)}`}
                className="min-w-0"
              >
                <Card size="sm" className="h-full">
                  <CardHeader>
                    <CardDescription>Worker</CardDescription>
                    <CardTitle className="font-sans text-base font-medium">
                      {worker.name || worker.slug}
                    </CardTitle>
                  </CardHeader>
                  <div className="text-muted-foreground flex flex-col gap-1 px-4 pb-4 text-sm">
                    <p>
                      {taskCount} {taskCount === 1 ? "task" : "tasks"} with this
                      agent
                    </p>
                    <p className="text-foreground line-clamp-2">
                      Latest: {lastJob.brief}
                    </p>
                    <p>{statusCopy(lastJob.status)}</p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium">Tasks</p>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Jobs you ran with this agent. Open one to read the memo.
          </p>
        </div>
        {jobs.length === 0 ? (
          <EmptyCard
            title="No tasks yet"
            hint="Run a task with this agent. Finished and in-progress jobs will list here."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {jobs.map((job) => (
              <TaskCard
                key={idOf(job._id)}
                job={job}
                staffing={staffingCaption(
                  staffing.get(idOf(job._id)) ?? { workerNames: [] }
                )}
              />
            ))}
          </div>
        )}
      </section>

      <AgentReviews listingId={listingId} summary={reviews} />
    </div>
  )
}
