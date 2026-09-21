import { loadLocalEnv } from "../src/lib/load-env"

loadLocalEnv()
process.env.AGENT_PROVIDER = "cerebras"
process.env.WORKER_IN_PROCESS = "1"

import { connect, disconnect } from "../src/db/connect"
import { Job, Listing, Snapshot, User } from "../src/db/models"
import { startListingJob } from "../src/domain/listing-jobs"
import { hex } from "../src/lib/ids"
import { drain } from "../src/worker/index"

const BRIEF = "eth and its future growth opportunity in ai agents"

async function main() {
  await connect()
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

  const listing = await Listing.create({
    slug: `eth-ai-${Math.random().toString(36).slice(2, 8)}`,
    kind: "worker",
    ownerUserId: hex(user._id),
    vertical: "research",
    priceCents: 2000,
    runtime: "hosted_prompt",
    status: "live",
    name: "ETH AI agents research",
    summary:
      "In-depth research on Ethereum and future growth opportunity in AI agents.",
    skills: "crypto, web research, sourced memos",
    prompt:
      "Research Ethereum (ETH) and its future growth opportunity in AI agents. Call custom APIs first, then parallel web search and Firecrawl. Write a long A–Z sourced memo with at least 12 sources. Include CoinGecko price context. Do not recommend trades.",
    tools: ["web_search", "fetch_page", "crypto"],
    isPublic: false,
    defaultBrief: BRIEF,
    runImmediately: true,
    scheduleCadence: "off",
  })

  const job = await startListingJob(user, listing)
  console.log(`started job ${hex(job._id)}`)
  await drain(80)
  const done = await Job.findById(job._id)
  const snaps = await Snapshot.countDocuments({ jobId: job._id })
  console.log(
    JSON.stringify({
      jobId: hex(job._id),
      status: done?.status,
      cancelReason: done?.cancelReason ?? "",
      snapshots: snaps,
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
