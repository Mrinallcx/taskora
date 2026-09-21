import { loadLocalEnv } from "../src/lib/load-env"

loadLocalEnv()
process.env.ALLOW_TEST_AUTH = "1"
process.env.WORKER_IN_PROCESS = "1"
process.env.AGENT_PROVIDER = process.env.HIRE_E2E_PROVIDER ?? "fake"
process.env.FAKE_EVAL = "pass"
process.env.FAKE_LEAD = "default"

import { connect, disconnect } from "../src/db/connect"
import {
  Assignment,
  Job,
  Ledger,
  Listing,
  Task,
  User,
} from "../src/db/models"
import {
  acceptJob,
  applyPlan,
  approvePlan,
  createJob,
  fundJob,
} from "../src/domain/jobs"
import { hex } from "../src/lib/ids"
import { drain } from "../src/worker/index"

const stamp = Math.random().toString(36).slice(2, 8)
const skillToken = `hireloop-${stamp}`

type Check = { name: string; ok: boolean; detail: string }

async function clerkUser() {
  const previous = await Job.findOne({
    clerkUserId: { $regex: /^user_/ },
  }).sort({ createdAt: -1 })
  const user = previous
    ? await User.findById(previous.userId)
    : await User.findOne({ clerkUserId: { $regex: /^user_/ } }).sort({
        updatedAt: -1,
      })
  if (!user?.clerkUserId?.startsWith("user_")) {
    throw new Error("No signed-in Clerk user found. Open the app once, then retry.")
  }
  return user
}

async function makeWorker(
  ownerUserId: string,
  name: string,
  skills: string,
  prompt: string
) {
  return Listing.create({
    slug: `${name.toLowerCase()}-${stamp}`,
    kind: "worker",
    ownerUserId,
    vertical: "research",
    priceCents: 4500,
    runtime: "hosted_prompt",
    status: "live",
    name,
    summary: `${name} hire-loop e2e worker`,
    skills,
    prompt,
    isPublic: true,
    tools: ["web_search", "fetch_page"],
  })
}

async function waitDelivered(jobId: unknown, maxTicks = 60) {
  for (let i = 0; i < maxTicks; i += 1) {
    await drain(8)
    const job = await Job.findById(jobId)
    if (job?.status === "delivered" || job?.status === "settled") return job
    if (job?.status === "cancelled") return job
  }
  return Job.findById(jobId)
}

function listingHex(id: unknown) {
  return hex(id as { toString(): string })
}

async function main() {
  await connect()
  const user = await clerkUser()
  const ownerId = hex(user._id)
  const checks: Check[] = []

  const scribe = await makeWorker(
    ownerId,
    "ScribeE2E",
    "long-form, citations",
    "Write the memo as ScribeE2E. Mention ScribeE2E in the first sentence."
  )
  const sourcer = await makeWorker(
    ownerId,
    "SourcerE2E",
    "web search, sources",
    "Gather sources as SourcerE2E."
  )
  const numbers = await makeWorker(
    ownerId,
    "NumbersE2E",
    skillToken,
    "Price the asset as NumbersE2E."
  )

  const named = await createJob(user, {
    brief: "History of tea trade, last 20 years. Cite public sources.",
    domain: "general",
    budgetCents: 2000,
  })
  await fundJob(user._id, hex(named._id))
  const planned = await applyPlan(hex(named._id), {
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
  if (!planned.ok) throw new Error("Named plan was rejected")
  await approvePlan(user._id, hex(named._id))

  const namedTasks = await Task.find({ jobId: named._id })
  const byType = Object.fromEntries(
    namedTasks.map((row) => [row.type, listingHex(row.listingId)])
  )
  checks.push({
    name: "named sources listing",
    ok: byType.sources === listingHex(sourcer._id),
    detail: `sources=${byType.sources} expected=${listingHex(sourcer._id)}`,
  })
  checks.push({
    name: "named report listing",
    ok: byType.report === listingHex(scribe._id),
    detail: `report=${byType.report} expected=${listingHex(scribe._id)}`,
  })

  const before = await User.findById(user._id)
  const startAvail = before?.availableCents ?? 0
  const startEscrow = before?.escrowedCents ?? 0

  const delivered = await waitDelivered(named._id)
  checks.push({
    name: "named job delivered",
    ok: delivered?.status === "delivered",
    detail: `status=${delivered?.status} cancel=${delivered?.cancelReason ?? ""}`,
  })

  if (delivered?.status === "delivered") {
    await acceptJob(user._id, hex(named._id))
  }
  const workerLines = await Ledger.find({ jobId: named._id, role: "worker" })
  const workerPay = workerLines.reduce((sum, row) => sum + row.cents, 0)
  checks.push({
    name: "worker ledger pays owner",
    ok:
      workerLines.length > 0 &&
      workerLines.every((row) => row.payeeUserId === ownerId) &&
      workerPay === 900,
    detail: `lines=${workerLines.length} payee=${workerLines.map((row) => row.payeeUserId).join(",")} cents=${workerPay}`,
  })
  const after = await User.findById(user._id)
  checks.push({
    name: "owner wallet credited 900",
    ok: (after?.availableCents ?? 0) === startAvail + 900,
    detail: `available ${startAvail} -> ${after?.availableCents} escrow ${startEscrow} -> ${after?.escrowedCents}`,
  })

  const matched = await createJob(user, {
    brief: `Need ${skillToken} quotes for this research brief.`,
    domain: "general",
    budgetCents: 2000,
  })
  await fundJob(user._id, hex(matched._id))
  const matchedPlan = await applyPlan(hex(matched._id), {
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
  if (!matchedPlan.ok) throw new Error("Skill-match plan was rejected")
  await approvePlan(user._id, hex(matched._id))
  const matchSources = await Task.findOne({ jobId: matched._id, type: "sources" })
  checks.push({
    name: "skill match staffs NumbersE2E",
    ok: listingHex(matchSources?.listingId) === listingHex(numbers._id),
    detail: `sources=${listingHex(matchSources?.listingId)} expected=${listingHex(numbers._id)}`,
  })

  const hired = await createJob(user, {
    brief: "History of tea trade, last 20 years. Cite public sources.",
    domain: "general",
    budgetCents: 2000,
    listingId: scribe._id,
  })
  await fundJob(user._id, hex(hired._id))
  const hiredPlan = await applyPlan(hex(hired._id), {
    tasks: [
      { type: "scope", listingSlug: sourcer.slug },
      { type: "sources", listingSlug: sourcer.slug },
      { type: "findings", listingSlug: sourcer.slug },
      { type: "report", listingSlug: sourcer.slug },
    ],
    proposedListingSlugs: [sourcer.slug, "eval-research"],
    estimatedCostCents: 2000,
    questions: [],
  })
  if (!hiredPlan.ok) throw new Error("Hire-pin plan was rejected")
  await approvePlan(user._id, hex(hired._id))
  const hiredTasks = await Task.find({
    jobId: hired._id,
    type: { $in: ["scope", "sources", "findings", "report"] },
  })
  const pinOk = hiredTasks.every(
    (row) => listingHex(row.listingId) === listingHex(scribe._id)
  )
  checks.push({
    name: "marketplace hire pin beats plan",
    ok: pinOk && hiredTasks.length === 4,
    detail: hiredTasks.map((row) => `${row.type}:${listingHex(row.listingId)}`).join(", "),
  })

  const assigns = await Assignment.find({ jobId: named._id, role: "worker" })
  const assignedListings = [
    ...new Set(assigns.map((row) => listingHex(row.listingId))),
  ]
  checks.push({
    name: "named job assigned both workers",
    ok:
      assignedListings.includes(listingHex(scribe._id)) &&
      assignedListings.includes(listingHex(sourcer._id)),
    detail: assignedListings.join(", "),
  })

  const failed = checks.filter((row) => !row.ok)
  for (const row of checks) {
    console.log(`${row.ok ? "ok " : "FAIL"} ${row.name} — ${row.detail}`)
  }
  console.log(
    JSON.stringify({
      provider: process.env.AGENT_PROVIDER,
      namedJob: hex(named._id),
      namedPath: `/dashboard/${hex(named._id)}`,
      matchJob: hex(matched._id),
      hiredJob: hex(hired._id),
      scribe: scribe.slug,
      sourcer: sourcer.slug,
      numbers: numbers.slug,
      passed: checks.filter((row) => row.ok).length,
      failed: failed.length,
    })
  )
  await disconnect()
  if (failed.length > 0) process.exit(1)
}

main().catch(async (error) => {
  console.error("Hire e2e failed:", error instanceof Error ? error.message : error)
  try {
    await disconnect()
  } catch {
    // ignore
  }
  process.exit(1)
})
