import { loadLocalEnv } from "../src/lib/load-env"

loadLocalEnv()
process.env.AGENT_PROVIDER = "cerebras"
process.env.WORKER_IN_PROCESS = "1"

import { connect, disconnect } from "../src/db/connect"
import { Evaluation, Job, Listing, Snapshot, Task, User } from "../src/db/models"
import { startListingJob } from "../src/domain/listing-jobs"
import { hex } from "../src/lib/ids"
import { drain } from "../src/worker/index"

const BRIEF = "base and its future growth opportunity in ai agents"

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

async function main() {
  await connect()
  const user = await clerkUser()
  const ownerUserId = hex(user._id)

  const evaluator = await Listing.create({
    slug: `base-eval-${Math.random().toString(36).slice(2, 8)}`,
    kind: "evaluator",
    ownerUserId,
    vertical: "research",
    priceCents: 1200,
    runtime: "hosted_prompt",
    status: "live",
    name: "Base AI agents evaluator",
    summary: "Independent rubric for Base / AI-agent research memos.",
    skills: "citations, crypto, brief coverage",
    prompt:
      "You grade a research memo about Base (the blockchain) and its future growth opportunity in AI agents. Score brief_coverage, citation_quality, accuracy_tells, structure, and uncertainty 0-100. Fail if the memo is not about Base, cites fewer than 5 real sources, or invents figures. Comments must say whether the brief was answered.",
    tools: [],
    isPublic: true,
  })
  process.env.EVAL_LISTING_SLUG = evaluator.slug

  const listing = await Listing.create({
    slug: `base-ai-${Math.random().toString(36).slice(2, 8)}`,
    kind: "worker",
    ownerUserId,
    vertical: "research",
    priceCents: 2000,
    runtime: "hosted_prompt",
    status: "live",
    name: "Base AI agents research",
    summary: "In-depth research on Base and future growth opportunity in AI agents.",
    skills: "crypto, web research, sourced memos",
    prompt:
      "Research Base (Coinbase L2) and its future growth opportunity in AI agents. Call custom APIs first, then parallel web search and Firecrawl. Write a long A–Z sourced memo with at least 12 sources. Include CoinGecko price context if a BASE token or related asset applies. Do not recommend trades.",
    tools: ["web_search", "fetch_page", "crypto"],
    isPublic: false,
    defaultBrief: BRIEF,
    runImmediately: true,
    scheduleCadence: "off",
  })

  const job = await startListingJob(user, listing)
  console.log(
    JSON.stringify({
      phase: "started",
      jobId: hex(job._id),
      evaluatorId: hex(evaluator._id),
      evaluatorSlug: evaluator.slug,
      path: `/dashboard/${hex(job._id)}`,
    })
  )
  await drain(80)
  const done = await Job.findById(job._id)
  const snaps = await Snapshot.countDocuments({ jobId: job._id })
  const evalTask = await Task.findOne({ jobId: job._id, type: "evaluate" })
  const evaluation = await Evaluation.findOne({ jobId: job._id }).sort({ round: -1 })
  console.log(
    JSON.stringify({
      phase: "done",
      jobId: hex(job._id),
      status: done?.status,
      cancelReason: done?.cancelReason ?? "",
      snapshots: snaps,
      evalTaskStatus: evalTask?.status ?? null,
      evalListingId: evalTask?.listingId ? hex(evalTask.listingId) : null,
      hiredLaunchedEval: String(evalTask?.listingId) === String(evaluator._id),
      evalPass: evaluation?.pass ?? null,
      evalScores: evaluation?.scores ?? null,
      evalHardFails: evaluation?.hardFails ?? [],
      evalComments: evaluation?.comments ?? "",
      path: `/dashboard/${hex(job._id)}`,
    })
  )
  await disconnect()
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error)
  try {
    await disconnect()
  } catch {
    // ignore
  }
  process.exit(1)
})
