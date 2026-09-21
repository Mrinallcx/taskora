import { Listing } from "@/src/db/models"
import { needFromBrief, rankBySkill } from "@/src/domain/skills"

const WORKER_LIMIT = 8
const EVAL_LIMIT = 4

function ensureSeed<T extends { slug: string }>(picked: T[], seed: T | undefined, limit: number) {
  if (!seed) return picked.slice(0, limit)
  if (picked.some((row) => row.slug === seed.slug)) return picked.slice(0, limit)
  return [seed, ...picked.filter((row) => row.slug !== seed.slug)].slice(0, limit)
}

function line(
  row: { slug: string; kind: string; name?: string; skills?: string | null }
) {
  const skills = String(row.skills ?? "").trim()
  const name = String(row.name ?? "").trim()
  return `- ${row.slug} [${row.kind}]${name ? ` ${name}` : ""}${skills ? ` skills: ${skills}` : ""}`
}

export async function formatHireCatalog(opts: {
  brief: string
  leadSkills?: string | null
}) {
  const need = needFromBrief(opts.brief, opts.leadSkills)
  const [workers, evals] = await Promise.all([
    Listing.find({ kind: "worker", status: "live" }).select(
      "slug kind name skills"
    ),
    Listing.find({ kind: "evaluator", status: "live" }).select(
      "slug kind name skills"
    ),
  ])
  const seedWorker =
    workers.find((row) => row.slug === "worker-research") ||
    workers.find((row) => row.slug === "research-handoff")
  const seedEval = evals.find((row) => row.slug === "eval-research")
  const pickedWorkers = ensureSeed(
    rankBySkill(need, workers, WORKER_LIMIT),
    seedWorker,
    WORKER_LIMIT
  )
  const pickedEvals = ensureSeed(
    rankBySkill(need, evals, EVAL_LIMIT),
    seedEval,
    EVAL_LIMIT
  )
  if (pickedWorkers.length === 0 && pickedEvals.length === 0) return ""
  return [
    "Hire catalog (propose only these slugs):",
    ...pickedWorkers.map(line),
    ...pickedEvals.map(line),
  ].join("\n")
}
