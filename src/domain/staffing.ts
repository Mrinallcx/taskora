import { isIndependent } from "@/src/domain/allowlists"
import { bestSkillMatch, parseSkills } from "@/src/domain/skills"

export const WORKER_STAGE_TYPES = ["scope", "sources", "findings", "report"] as const
export type WorkerStageType = (typeof WORKER_STAGE_TYPES)[number]

export type StaffListing = {
  slug: string
  kind: string
  status?: string
  skills?: string | null
  ownerUserId: string
}

export type PlanTask = {
  type?: string
  listingSlug?: string
}

function isLive<T extends StaffListing>(row: T | null | undefined, kind: string): row is T {
  if (!row || row.kind !== kind) return false
  return !row.status || row.status === "live"
}

function bySlug<T extends StaffListing>(rows: T[], slug?: string) {
  if (!slug) return undefined
  return rows.find((row) => row.slug === slug)
}

export function splitCentsByShares(total: number, shares: number[]) {
  if (shares.length === 0) return []
  const weight = shares.reduce((sum, share) => sum + share, 0)
  if (total <= 0 || weight <= 0) return shares.map(() => 0)
  const parts = shares.map((share) => Math.floor((total * share) / weight))
  parts[parts.length - 1] += total - parts.reduce((sum, part) => sum + part, 0)
  return parts
}

export function staffJobListings<T extends StaffListing>(opts: {
  ownerListing?: T | null
  proposed: T[]
  planTasks: PlanTask[]
  liveWorkers: T[]
  liveEvals: T[]
  defaultWorker: T
  defaultEval: T
  need: string[]
}): { workersByType: Record<WorkerStageType, T>; evaluator: T } {
  const proposedWorkers = opts.proposed.filter((row) => isLive(row, "worker"))
  const proposedEvals = opts.proposed.filter((row) => isLive(row, "evaluator"))
  const pinned =
    isLive(opts.ownerListing, "worker") && opts.ownerListing
      ? opts.ownerListing
      : null
  const namedWorker = proposedWorkers[0]
  const matchedWorker = bestSkillMatch(opts.need, opts.liveWorkers)
  const fallbackWorker = pinned ?? namedWorker ?? matchedWorker ?? opts.defaultWorker

  const workersByType = {} as Record<WorkerStageType, T>
  for (const type of WORKER_STAGE_TYPES) {
    if (pinned) {
      workersByType[type] = pinned
      continue
    }
    const taskSlug = opts.planTasks.find((row) => row.type === type)?.listingSlug
    const named = bySlug(opts.proposed, taskSlug)
    workersByType[type] = isLive(named, "worker") && named ? named : fallbackWorker
  }

  const evalSlug = opts.planTasks.find((row) => row.type === "evaluate")?.listingSlug
  const namedFromTask = bySlug(opts.proposed, evalSlug)
  const pickedNamed = isLive(namedFromTask, "evaluator")
    ? namedFromTask
    : proposedEvals[0]
  const workerOwners = [
    ...new Set(WORKER_STAGE_TYPES.map((type) => workersByType[type].ownerUserId)),
  ]
  const evalNeed = [
    ...opts.need,
    ...parseSkills(
      WORKER_STAGE_TYPES.map((type) => workersByType[type].skills ?? "").join(",")
    ),
  ]
  const namedIsDefault = !pickedNamed || pickedNamed.slug === opts.defaultEval.slug
  let evaluator = pickedNamed ?? opts.defaultEval
  if (namedIsDefault) {
    const independent = opts.liveEvals.filter((row) =>
      isIndependent(row.ownerUserId, workerOwners)
    )
    const matched = bestSkillMatch(evalNeed, independent)
    if (matched) evaluator = matched
  }
  if (!isLive(evaluator, "evaluator")) evaluator = opts.defaultEval

  return { workersByType, evaluator }
}
