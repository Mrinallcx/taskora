import { Assignment, Job, Listing } from "@/src/db/models"
import { asObjectId, hex } from "@/src/lib/ids"

function listingLabel(row: { name?: string; slug: string }) {
  return row.name || row.slug
}

function idHex(value: unknown) {
  if (typeof value === "string") return value
  if (value && typeof value === "object" && "toString" in value) {
    return String((value as { toString(): string }).toString())
  }
  return String(value)
}

export type JobStaffing = {
  agentName?: string
  agentId?: string
  workerNames: string[]
  workerIds?: string[]
  hiredKind?: string
}

export function staffingCaption(row: JobStaffing) {
  const workers = row.workerNames.join(", ")
  if (row.hiredKind === "worker" && workers) return `You hired ${workers}`
  if (row.agentName && workers) return `${row.agentName} hired ${workers}`
  if (row.agentName) return `Agent: ${row.agentName}`
  if (workers) return `Worker: ${workers}`
  return ""
}

export async function staffingForJobs(
  jobs: { _id: unknown; listingId?: unknown }[]
) {
  const out = new Map<string, JobStaffing>()
  if (jobs.length === 0) return out
  const jobIds = jobs.map((job) => job._id)
  const assigns = await Assignment.find({ jobId: { $in: jobIds } }).select(
    "jobId listingId role"
  )
  const listingIds = new Set<string>()
  for (const job of jobs) {
    if (job.listingId) listingIds.add(idHex(job.listingId))
  }
  for (const row of assigns) {
    listingIds.add(hex(row.listingId))
  }
  const listings = await Listing.find({
    _id: {
      $in: [...listingIds].map((value) => asObjectId(value)).filter(Boolean),
    },
  }).select("name slug kind")
  const byListing = new Map(listings.map((row) => [hex(row._id), row]))
  const assignsByJob = new Map<string, typeof assigns>()
  for (const row of assigns) {
    const key = hex(row.jobId)
    const list = assignsByJob.get(key) ?? []
    list.push(row)
    assignsByJob.set(key, list)
  }

  for (const job of jobs) {
    const id = idHex(job._id)
    const hired = job.listingId ? byListing.get(idHex(job.listingId)) : undefined
    const jobAssigns = assignsByJob.get(id) ?? []
    const leadAssign = jobAssigns.find((row) => row.role === "lead")
    const agent =
      hired?.kind === "lead"
        ? hired
        : leadAssign
          ? byListing.get(hex(leadAssign.listingId))
          : undefined
    const workerNames: string[] = []
    const workerIds: string[] = []
    const seen = new Set<string>()
    for (const row of jobAssigns) {
      if (row.role !== "worker") continue
      const listingId = hex(row.listingId)
      if (seen.has(listingId)) continue
      seen.add(listingId)
      const listing = byListing.get(listingId)
      if (!listing) continue
      workerIds.push(listingId)
      workerNames.push(listingLabel(listing))
    }
    out.set(id, {
      agentName: agent ? listingLabel(agent) : undefined,
      agentId: agent ? hex(agent._id) : undefined,
      workerNames,
      workerIds,
      hiredKind: hired?.kind,
    })
  }
  return out
}

export function lastJobPerWorker(
  jobs: { _id: unknown }[],
  staffing: Map<string, JobStaffing>
) {
  const rows: { workerId: string; workerName: string; jobId: string }[] = []
  const seen = new Set<string>()
  for (const job of jobs) {
    const staff = staffing.get(idHex(job._id))
    const ids = staff?.workerIds ?? []
    for (let i = 0; i < ids.length; i += 1) {
      const workerId = ids[i]
      if (!workerId || seen.has(workerId)) continue
      seen.add(workerId)
      rows.push({
        workerId,
        workerName: staff?.workerNames[i] ?? "",
        jobId: idHex(job._id),
      })
    }
  }
  return rows
}

export async function jobsForAgent(agentListingId: string, userId: unknown) {
  const id = asObjectId(agentListingId)
  if (!id || !userId) return []
  const [pinned, leadAssigns] = await Promise.all([
    Job.find({ listingId: id, userId }).sort({ createdAt: -1 }),
    Assignment.find({ listingId: id, role: "lead" }).select("jobId"),
  ])
  const fromLead =
    leadAssigns.length > 0
      ? await Job.find({
          _id: { $in: leadAssigns.map((row) => row.jobId) },
          userId,
        }).sort({ createdAt: -1 })
      : []
  const byId = new Map<string, (typeof pinned)[number]>()
  for (const job of [...pinned, ...fromLead]) {
    byId.set(hex(job._id), job)
  }

  const hiredAt = pinned.at(-1)?.createdAt ?? fromLead.at(-1)?.createdAt
  if (hiredAt) {
    const unpinned = await Job.findOne({
      userId,
      createdAt: { $gte: hiredAt },
      $or: [{ listingId: null }, { listingId: { $exists: false } }],
    }).sort({ createdAt: -1 })
    if (unpinned) {
      const key = hex(unpinned._id)
      if (!byId.has(key)) byId.set(key, unpinned)
    }
  }

  return [...byId.values()].sort((a, b) => {
    const aTime = a.createdAt ? +new Date(a.createdAt) : 0
    const bTime = b.createdAt ? +new Date(b.createdAt) : 0
    return bTime - aTime
  })
}

export async function workerRowsForAgent(agentListingId: string, userId: unknown) {
  const jobs = await jobsForAgent(agentListingId, userId)
  if (jobs.length === 0) return { jobs, workers: [] }
  const staffing = await staffingForJobs(jobs)
  const rows = lastJobPerWorker(jobs, staffing)
  const listings = await Listing.find({
    _id: {
      $in: rows.map((row) => asObjectId(row.workerId)).filter(Boolean),
    },
  })
  const byListing = new Map(listings.map((row) => [hex(row._id), row]))
  const workers = []
  for (const row of rows) {
    const listing = byListing.get(row.workerId)
    const lastJob = jobs.find((job) => hex(job._id) === row.jobId)
    if (!listing || !lastJob) continue
    workers.push({ listing, lastJob })
  }
  return { jobs, workers }
}

export async function workersForAgent(agentListingId: string, userId: unknown) {
  const { workers } = await workerRowsForAgent(agentListingId, userId)
  return workers.map((row) => row.listing)
}

export async function jobsForWorker(workerListingId: string, userId: unknown) {
  const id = asObjectId(workerListingId)
  if (!id) return []
  const assigns = await Assignment.find({
    listingId: id,
    role: "worker",
  }).select("jobId")
  const fromAssign = assigns.map((row) => row.jobId)
  const fromOwner = await Job.find({ listingId: id, userId }).select("_id")
  const ids = [
    ...new Set(
      [...fromAssign, ...fromOwner.map((row) => row._id)].map((value) => hex(value))
    ),
  ]
    .map((value) => asObjectId(value))
    .filter(Boolean)
  if (ids.length === 0) return []
  return Job.find({ userId, _id: { $in: ids } }).sort({ createdAt: -1 })
}

export async function dashboardCatalog(
  ownerUserId: string,
  jobs: { _id: unknown; listingId?: unknown }[]
) {
  const hiredIds = jobs
    .map((job) => job.listingId)
    .filter(Boolean)
    .map((value) => asObjectId(idHex(value)))
    .filter(Boolean)
  const assigned = await Assignment.find({
    jobId: { $in: jobs.map((job) => job._id) },
    role: { $in: ["worker", "lead"] },
  }).select("listingId role")
  const assignedIds = assigned
    .filter((row) => row.role === "worker")
    .map((row) => asObjectId(hex(row.listingId)))
    .filter(Boolean)
  const leadIds = [
    ...hiredIds,
    ...assigned
      .filter((row) => row.role === "lead")
      .map((row) => asObjectId(hex(row.listingId)))
      .filter(Boolean),
  ]

  const [ownedAgents, hiredAgents, ownedWorkers, assignedWorkers] = await Promise.all([
    Listing.find({ ownerUserId, kind: "lead", status: "live" }).sort({
      createdAt: -1,
    }),
    leadIds.length > 0
      ? Listing.find({ _id: { $in: leadIds }, kind: "lead" })
      : Promise.resolve([]),
    Listing.find({ ownerUserId, kind: "worker", status: "live" }).sort({
      createdAt: -1,
    }),
    assignedIds.length > 0
      ? Listing.find({ _id: { $in: assignedIds }, kind: "worker" })
      : Promise.resolve([]),
  ])

  function merge<T extends { _id: unknown }>(owned: T[], extra: T[]) {
    const seen = new Set(owned.map((row) => idHex(row._id)))
    const out = [...owned]
    for (const row of extra) {
      const id = idHex(row._id)
      if (seen.has(id)) continue
      seen.add(id)
      out.push(row)
    }
    return out
  }

  return {
    agents: merge(ownedAgents, hiredAgents),
    workers: merge(ownedWorkers, assignedWorkers),
  }
}
