import { readFile } from "node:fs/promises"
import path from "node:path"

import { connect } from "@/src/db/connect"
import { Snapshot } from "@/src/db/models"
import { pickEvidenceSnapshots, isPriceTool } from "@/src/domain/evidence"
import { hex } from "@/src/lib/ids"

async function loadFixture(name: string) {
  const file = path.join(process.cwd(), "e2e/fixtures/models", name)
  const raw = await readFile(file, "utf8")
  return JSON.parse(raw) as Record<string, unknown>
}

async function citationsFromJob(jobId: string) {
  await connect()
  const snapshots = pickEvidenceSnapshots(
    await Snapshot.find({ jobId }).sort({ createdAt: 1 }),
    12
  )
  return snapshots.map((row) => {
    const text = row.text.replace(/\s+/g, " ").trim()
    const quote = /\btea\b/i.test(text)
      ? (text.match(/\btea\b/i)?.[0] ?? "tea")
      : text.slice(0, 48)
    return {
      snapshotId: hex(row._id),
      url: row.url,
      quote,
      sourceClass: isPriceTool(row.toolName) ? ("price" as const) : ("web" as const),
    }
  })
}

export async function runFakeAgent(input: {
  kind: string
  type: string
  jobId: string
  round: number
}) {
  if (input.kind === "lead" && input.type === "plan") {
    const variant = process.env.FAKE_LEAD ?? "default"
    const file =
      variant === "overbudget"
        ? "lead-plan-overbudget.json"
        : variant === "badjson"
          ? "lead-plan-badjson.json"
          : "lead-plan.json"
    const payload = await loadFixture(file)
    if (variant !== "default") return payload
    const evalSlug = process.env.EVAL_LISTING_SLUG
    const workerSlug = process.env.FAKE_WORKER_SLUG
    const proposed = [
      ...(workerSlug ? [workerSlug] : ["worker-research"]),
      ...(evalSlug ? [evalSlug] : ["eval-research"]),
    ]
    const tasks = Array.isArray(payload.tasks)
      ? (payload.tasks as { type?: string }[]).map((task) =>
          workerSlug && task.type && task.type !== "evaluate"
            ? { ...task, listingSlug: workerSlug }
            : task
        )
      : payload.tasks
    return { ...payload, tasks, proposedListingSlugs: proposed }
  }
  if (input.kind === "worker" && input.type === "scope") {
    return loadFixture("worker-scope.json")
  }
  if (input.kind === "worker" && (input.type === "sources" || input.type === "findings")) {
    const payload = await loadFixture(
      input.type === "sources" ? "worker-sources.json" : "worker-findings.json"
    )
    const citations = await citationsFromJob(input.jobId)
    return { ...payload, citations }
  }
  if (input.kind === "worker" && input.type === "report") {
    const payload = await loadFixture("worker-report.json")
    const citations = await citationsFromJob(input.jobId)
    return {
      ...payload,
      citationIds: citations.map((row) => row.snapshotId),
      citations,
    }
  }
  if (input.kind === "evaluator" && input.type === "evaluate") {
    const seq = (process.env.FAKE_EVAL ?? "pass").split(",")
    const key = seq[Math.min(input.round, seq.length - 1)]
    if (key === "liar") return loadFixture("eval-liar.json")
    if (key === "fail") return loadFixture("eval-fail.json")
    return loadFixture("eval-pass.json")
  }
  throw new Error(`No fake fixture for ${input.kind}/${input.type}`)
}
