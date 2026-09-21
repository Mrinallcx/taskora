"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { ListingCard, TaskCard } from "@/components/dashboard-cards"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  budgetFromListing,
  domainFromListingTools,
} from "@/src/domain/listing-defaults"

export type MarketplaceListing = {
  _id: string
  kind: string
  name?: string
  slug: string
  summary?: string
  skills?: string
  priceCents?: number
  tools?: string[]
  defaultBrief?: string
}

export type MarketplaceTask = {
  _id: string
  domain: string
  brief: string
  status: string
  createdAt?: string
  budgetCents?: number
}

function hireCopy(kind: "agent" | "worker" | "task") {
  if (kind === "agent") {
    return "This agent will plan the job and hire a worker. You still need a brief, domain, and budget to start."
  }
  if (kind === "worker") {
    return "This worker will research and write the memo. You still need a brief, domain, and budget to start."
  }
  return "This runs a new funded job from this brief. Edit anything before you hire."
}

async function launchHiredJob(input: {
  brief: string
  domain: string
  budgetCents: number
  listingId?: string
}) {
  const created = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      brief: input.brief,
      domain: input.domain,
      budgetCents: input.budgetCents,
      listingId: input.listingId,
      autoApprovePlan: true,
    }),
  })
  const json = (await created.json()) as {
    id?: string
    error?: { message?: string }
  }
  if (!created.ok || !json.id) {
    throw new Error(json.error?.message ?? "Could not start this hire.")
  }
  const funded = await fetch(`/api/jobs/${json.id}/fund`, { method: "POST" })
  if (!funded.ok) {
    const fail = (await funded.json()) as { error?: { message?: string } }
    throw new Error(fail.error?.message ?? "Job created, but funding failed.")
  }
  return json.id
}

function HireButton() {
  return (
    <DialogTrigger type="button" className={buttonVariants({ size: "xs" })}>
      Hire
    </DialogTrigger>
  )
}

function HireForm({
  title,
  description,
  defaultBrief,
  defaultDomain,
  defaultBudget,
  listingId,
  formId,
}: {
  title: string
  description: string
  defaultBrief: string
  defaultDomain: string
  defaultBudget: number
  listingId?: string
  formId: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [domain, setDomain] = useState(defaultDomain)

  return (
    <DialogContent>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          setPending(true)
          try {
            const jobId = await launchHiredJob({
              brief: String(data.get("brief") ?? ""),
              domain,
              budgetCents: Number(String(data.get("budgetCents") ?? defaultBudget)),
              listingId,
            })
            toast.success("Hired. Job is running.")
            router.push(`/dashboard/${jobId}`)
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not hire.")
          } finally {
            setPending(false)
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-3">
          <Field className="gap-1">
            <FieldLabel htmlFor={`${formId}-brief`}>Brief</FieldLabel>
            <Textarea
              id={`${formId}-brief`}
              name="brief"
              required
              rows={5}
              className="min-h-24 field-sizing-fixed"
              defaultValue={defaultBrief}
              placeholder="What should be researched?"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field className="gap-1">
                <FieldLabel htmlFor={`${formId}-domain`}>Domain</FieldLabel>
                <Select
                  value={domain}
                  onValueChange={(value) => value && setDomain(value)}
                >
                  <SelectTrigger id={`${formId}-domain`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="academic">Academic</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field className="gap-1">
                <FieldLabel htmlFor={`${formId}-budget`}>Budget (cents)</FieldLabel>
                <Input
                  id={`${formId}-budget`}
                name="budgetCents"
                type="number"
                min={2000}
                max={10000}
                defaultValue={defaultBudget}
              />
            </Field>
          </div>
        </FieldGroup>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" size="sm" />}>
            Cancel
          </DialogClose>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Hiring" : "Hire"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

export function MarketplaceListingCard({
  listing,
}: {
  listing: MarketplaceListing
}) {
  const kind = listing.kind === "worker" ? "worker" : "agent"
  const brief = String(listing.defaultBrief || listing.summary || "").trim()

  return (
    <Dialog>
      <ListingCard listing={listing} action={<HireButton />} />
      <HireForm
        title={`Hire ${listing.name || listing.slug}`}
        description={hireCopy(kind)}
        defaultBrief={brief}
        defaultDomain={domainFromListingTools(listing.tools)}
        defaultBudget={budgetFromListing(listing.priceCents ?? 0)}
        listingId={listing._id}
        formId={`hire-${listing._id}`}
      />
    </Dialog>
  )
}

export function MarketplaceTaskCard({ job }: { job: MarketplaceTask }) {
  return (
    <Dialog>
      <TaskCard
        job={{
          ...job,
          createdAt: job.createdAt ? new Date(job.createdAt) : undefined,
        }}
        href={null}
        action={<HireButton />}
      />
      <HireForm
        title="Hire this task"
        description={hireCopy("task")}
        defaultBrief={job.brief}
        defaultDomain={job.domain === "news" ? "general" : job.domain}
        defaultBudget={budgetFromListing(job.budgetCents ?? 0)}
        formId={`hire-task-${job._id}`}
      />
    </Dialog>
  )
}
