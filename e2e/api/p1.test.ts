import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { Artifact, Job, Ledger, Listing, Snapshot, Task, User } from "@/src/db/models"
import {
  acceptJob,
  applyPlan,
  approvePlan,
  createJob,
  fundJob,
  settleJob,
} from "@/src/domain/jobs"
import { isCitableTool } from "@/src/domain/evidence"
import { gatherInDepthSources } from "@/src/domain/research"
import { isIndependent } from "@/src/domain/allowlists"
import { getSessionUser } from "@/src/lib/auth"
import { hex } from "@/src/lib/ids"
import { drain } from "@/src/worker/index"
import { startTestMongo, stopTestMongo } from "@/e2e/api/setup"

beforeAll(async () => {
  await startTestMongo()
})

afterAll(async () => {
  await stopTestMongo()
})

function req(id: string) {
  return new Request("http://localhost/api/me", {
    headers: { authorization: `Bearer test:${id}` },
  })
}

describe("P1 fake swarm", () => {
  it("P1-E2E-01 happy path receipt sums to escrow", async () => {
    process.env.FAKE_EVAL = "pass"
    const user = await getSessionUser(req("p1-01"))
    const job = await createJob(user, {
      brief: "History of tea trade, last 20 years",
      domain: "general",
      budgetCents: 2000,
    })
    await fundJob(user._id, hex(job._id))
    await drain(20)
    const planned = await Job.findById(job._id)
    expect(planned?.status).toBe("plan_review")
    await approvePlan(user._id, hex(job._id))
    await drain(40)
    const delivered = await Job.findById(job._id)
    expect(delivered?.status).toBe("delivered")
    await acceptJob(user._id, hex(job._id))
    const settled = await Job.findById(job._id)
    expect(settled?.status).toBe("settled")
    const lines = await Ledger.find({ jobId: job._id })
    const sum = lines.reduce((acc, row) => acc + row.cents, 0)
    expect(sum).toBe(2000)
    const wallet = await User.findById(user._id)
    expect(wallet?.escrowedCents).toBe(0)
    const snaps = await Snapshot.find({ jobId: job._id })
    expect(snaps.length).toBeGreaterThanOrEqual(5)
    expect(snaps.every((row) => row.toolName !== "web_search")).toBe(true)
    const reportTask = await Task.findOne({ jobId: job._id, type: "report" })
    const report = await Artifact.findOne({ taskId: reportTask?._id }).sort({
      round: -1,
      attempt: -1,
    })
    const cited = (report?.citations ?? []) as { snapshotId?: string }[]
    expect(cited.length).toBeGreaterThanOrEqual(5)
    const byId = new Map(snaps.map((row) => [hex(row._id), row]))
    for (const citation of cited) {
      expect(isCitableTool(byId.get(String(citation.snapshotId))?.toolName)).toBe(true)
    }
  })

  it("P1-E2E-02 eval fail then pass on revision", async () => {
    process.env.FAKE_EVAL = "fail,pass"
    const user = await getSessionUser(req("p1-02"))
    const job = await createJob(user, {
      brief: "Tea trade revision path",
      domain: "general",
      budgetCents: 2000,
    })
    await fundJob(user._id, hex(job._id))
    await drain(20)
    await approvePlan(user._id, hex(job._id))
    await drain(60)
    const done = await Job.findById(job._id)
    expect(done?.status).toBe("delivered")
    expect(done?.revisionsUsed).toBe(1)
  })

  it("P1-CLAIM-01 two claims of the same queued task", async () => {
    const user = await getSessionUser(req("p1-claim"))
    const job = await createJob(user, {
      brief: "claim race tea",
      domain: "general",
      budgetCents: 2000,
    })
    await fundJob(user._id, hex(job._id))
    const { claimQueuedTask } = await import("@/src/domain/jobs")
    const [a, b] = await Promise.all([
      claimQueuedTask("w1"),
      claimQueuedTask("w2"),
    ])
    const winners = [a, b].filter(Boolean)
    expect(winners).toHaveLength(1)
    const running = await Task.countDocuments({
      jobId: job._id,
      status: "running",
    })
    expect(running).toBe(1)
  })

  it("P1-DAG-01 sources stay created until scope passes", async () => {
    const user = await getSessionUser(req("p1-dag"))
    const job = await createJob(user, {
      brief: "dag tea",
      domain: "general",
      budgetCents: 2000,
    })
    await fundJob(user._id, hex(job._id))
    await drain(20)
    await approvePlan(user._id, hex(job._id))
    const sources = await Task.findOne({ jobId: job._id, type: "sources" })
    expect(sources?.status).toBe("created")
  })

  it("P1-EVAL-IND-01 platform trio is independent", () => {
    expect(isIndependent("platform", ["platform"])).toBe(true)
    expect(isIndependent("user-a", ["user-a"])).toBe(false)
    expect(isIndependent("user-a", ["user-b"])).toBe(true)
  })

  it("P0-API-04 double settle is a no-op on ledger", async () => {
    process.env.FAKE_EVAL = "pass"
    const user = await getSessionUser(req("p0-04"))
    const job = await createJob(user, {
      brief: "settle twice",
      domain: "general",
      budgetCents: 2000,
    })
    await fundJob(user._id, hex(job._id))
    await drain(20)
    await approvePlan(user._id, hex(job._id))
    await drain(40)
    await acceptJob(user._id, hex(job._id))
    await settleJob(job._id, "full", {
      planApproved: true,
      workerTasksPassedSchema: 4,
      evalSubmitted: true,
    })
    const lines = await Ledger.find({ jobId: job._id })
    const roles = lines.map((row) => row.role).sort()
    expect(roles.filter((role) => role === "lead")).toHaveLength(1)
  })

  it("staffs named workers and pays their owner", async () => {
    process.env.FAKE_EVAL = "pass"
    const user = await getSessionUser(req("p1-hire"))
    const ownerId = hex(user._id)
    const scribe = await Listing.create({
      slug: `scribe-${ownerId.slice(-8)}`,
      kind: "worker",
      ownerUserId: ownerId,
      vertical: "research",
      priceCents: 4500,
      runtime: "hosted_prompt",
      status: "live",
      name: "Scribe",
      skills: "long-form, citations",
      prompt: "Write as Scribe.",
      isPublic: true,
      tools: ["web_search", "fetch_page"],
    })
    const sourcer = await Listing.create({
      slug: `sourcer-${ownerId.slice(-8)}`,
      kind: "worker",
      ownerUserId: ownerId,
      vertical: "research",
      priceCents: 4500,
      runtime: "hosted_prompt",
      status: "live",
      name: "Sourcer",
      skills: "web search, crypto",
      prompt: "Gather sources.",
      isPublic: true,
      tools: ["web_search", "fetch_page"],
    })
    const job = await createJob(user, {
      brief: "History of tea trade, last 20 years",
      domain: "general",
      budgetCents: 2000,
    })
    await fundJob(user._id, hex(job._id))
    await applyPlan(hex(job._id), {
      tasks: [
        { type: "scope", listingSlug: scribe.slug },
        { type: "sources", listingSlug: sourcer.slug },
        { type: "findings", listingSlug: scribe.slug },
        { type: "report", listingSlug: scribe.slug },
      ],
      proposedListingSlugs: [scribe.slug, sourcer.slug, "eval-research"],
      estimatedCostCents: 2000,
      questions: [],
    })
    await approvePlan(user._id, hex(job._id))
    const sources = await Task.findOne({ jobId: job._id, type: "sources" })
    const report = await Task.findOne({ jobId: job._id, type: "report" })
    expect(hex(sources?.listingId as { toString(): string })).toBe(hex(sourcer._id))
    expect(hex(report?.listingId as { toString(): string })).toBe(hex(scribe._id))
    await drain(40)
    const delivered = await Job.findById(job._id)
    expect(delivered?.status).toBe("delivered")
    await acceptJob(user._id, hex(job._id))
    const workerLines = await Ledger.find({ jobId: job._id, role: "worker" })
    expect(workerLines.every((row) => row.payeeUserId === ownerId)).toBe(true)
    expect(workerLines.reduce((sum, row) => sum + row.cents, 0)).toBe(900)
    const wallet = await User.findById(user._id)
    expect(wallet?.availableCents).toBe(98900)
  })

  it("skill-matches a live worker when the plan names none", async () => {
    const user = await getSessionUser(req("p1-match"))
    const numbers = await Listing.create({
      slug: `numbers-${hex(user._id).slice(-8)}`,
      kind: "worker",
      ownerUserId: hex(user._id),
      vertical: "research",
      priceCents: 4500,
      runtime: "hosted_prompt",
      status: "live",
      name: "Numbers",
      skills: "crypto, quotes",
      prompt: "Price the asset.",
      isPublic: true,
      tools: ["crypto"],
    })
    const job = await createJob(user, {
      brief: "crypto quotes for bitcoin",
      domain: "finance",
      budgetCents: 2000,
    })
    await fundJob(user._id, hex(job._id))
    await applyPlan(hex(job._id), {
      tasks: [
        { type: "scope" },
        { type: "sources" },
        { type: "findings" },
        { type: "report" },
      ],
      proposedListingSlugs: ["eval-research"],
      estimatedCostCents: 2000,
      questions: [],
    })
    await approvePlan(user._id, hex(job._id))
    const sources = await Task.findOne({ jobId: job._id, type: "sources" })
    expect(hex(sources?.listingId as { toString(): string })).toBe(hex(numbers._id))
  })

  it("gather stores fetched pages, not search snippets", async () => {
    const user = await getSessionUser(req("p1-gather"))
    const job = await createJob(user, {
      brief: "History of tea trade, last 20 years",
      domain: "general",
      budgetCents: 2000,
    })
    await Snapshot.insertMany(
      Array.from({ length: 16 }, (_, i) => ({
        jobId: job._id,
        url: `https://serp.example/${i}`,
        text: "tea snippet",
        sha256: `snip-${i}`,
        toolName: "web_search",
        retrievedAt: new Date(),
      }))
    )
    const listing = await Listing.findOne({ slug: "worker-research" })
    const dummyTask = await Task.create({
      jobId: job._id,
      type: "sources",
      status: "running",
      listingId: listing!._id,
      attempt: 1,
      timeoutMs: 60_000,
    })
    await gatherInDepthSources(job, dummyTask._id, null)
    const rows = await Snapshot.find({ jobId: job._id })
    expect(rows.filter((row) => row.toolName === "web_search")).toHaveLength(16)
    expect(rows.some((row) => row.toolName === "fetch_page")).toBe(true)
    expect(rows.filter((row) => row.toolName === "fetch_page").length).toBeGreaterThanOrEqual(5)
  })
})
