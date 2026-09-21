import { loadLocalEnv } from "../src/lib/load-env"

loadLocalEnv()

import { connect, disconnect } from "../src/db/connect"
import { Invocation, Job, Snapshot, Task } from "../src/db/models"
import { createJob, fundJob, approvePlan, acceptJob } from "../src/domain/jobs"
import { getSessionUser } from "../src/lib/auth"
import { hex } from "../src/lib/ids"
import { firecrawlScrape, firecrawlSearch } from "../src/tools/search/firecrawl"
import { coinGeckoQuote } from "../src/tools/crypto/coingecko"
import { drain } from "../src/worker/index"

async function jobSnapshot(jobId: unknown) {
  const job = await Job.findById(jobId)
  const tasks = await Task.find({ jobId }).sort({ createdAt: 1 })
  return {
    status: job?.status,
    computeSpentCents: job?.computeSpentCents,
    tasks: tasks.map((row) => ({ type: row.type, status: row.status, attempt: row.attempt })),
  }
}

function req() {
  return new Request("http://localhost/api/me", {
    headers: { authorization: "Bearer test:live-e2e" },
  })
}

async function pingCerebras() {
  const key = process.env.CEREBRAS_API_KEY
  if (!key) throw new Error("CEREBRAS_API_KEY missing")
  const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-oss-120b",
      messages: [{ role: "user", content: 'Reply with JSON {"ok":true} only.' }],
      max_tokens: 64,
    }),
  })
  if (!response.ok) {
    throw new Error(`Cerebras ${response.status} ${await response.text()}`)
  }
  const json = (await response.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const text = json.choices?.[0]?.message?.content ?? ""
  if (!text) throw new Error("Cerebras returned empty content")
  return text.slice(0, 80)
}

async function main() {
  process.env.ALLOW_TEST_AUTH = "1"
  process.env.AGENT_PROVIDER = "cerebras"
  process.env.WORKER_IN_PROCESS = "1"

  const results: string[] = []

  const search = await firecrawlSearch("history of the global tea trade", 5)
  if (!search.ok) throw new Error(`Firecrawl search failed: ${search.message}`)
  console.log(`ok  Firecrawl search: ${search.data.hits.length} hits`)
  results.push(`Firecrawl search: ${search.data.hits.length} hits`)

  const first = search.data.hits[0]
  const scrape = await firecrawlScrape(first.url)
  if (!scrape.ok) throw new Error(`Firecrawl extract failed: ${scrape.message}`)
  console.log(`ok  Firecrawl extract: ${scrape.data.text.length} chars`)
  results.push(`Firecrawl extract: ${scrape.data.text.length} chars from ${new URL(first.url).hostname}`)

  const btc = await coinGeckoQuote("bitcoin")
  if (!btc.ok) throw new Error(`CoinGecko failed: ${btc.message}`)
  console.log(`ok  CoinGecko bitcoin: ${btc.data.price} ${btc.data.currency}`)
  results.push(`CoinGecko bitcoin: ${btc.data.price} ${btc.data.currency}`)

  const cerebrasText = await pingCerebras()
  console.log(`ok  Cerebras gpt-oss-120b ping`)
  results.push(`Cerebras gpt-oss-120b: ${cerebrasText.replace(/\s+/g, " ")}`)

  await connect()
  const user = await getSessionUser(req())
  const job = await createJob(user, {
    brief: "History of the global tea trade over the last 20 years. Cite public sources. Do not recommend stock trades.",
    domain: "general",
    budgetCents: 2000,
  })
  await fundJob(user._id, hex(job._id))
  await drain(20)
  const planned = await Job.findById(job._id)
  if (planned?.status !== "plan_review") {
    throw new Error(`Plan is not awaiting approval: ${JSON.stringify(await jobSnapshot(job._id))}`)
  }
  await approvePlan(user._id, hex(job._id))
  const fresh = await Job.findById(job._id)
  const crypto = await import("../src/tools/index").then((mod) =>
    mod.executeTool(fresh as never, fresh!._id, "crypto_quote", { symbol: "bitcoin" })
  )
  if (!crypto.ok) throw new Error(`crypto_quote during job failed: ${crypto.message}`)
  await drain(40)
  const delivered = await (await import("../src/db/models")).Job.findById(job._id)
  if (delivered?.status !== "delivered") {
    throw new Error(`Job ended in ${delivered?.status}, expected delivered: ${JSON.stringify(await jobSnapshot(job._id))}`)
  }
  await acceptJob(user._id, hex(job._id))
  const snapshots = await Snapshot.find({ jobId: job._id })
  const liveSnaps = snapshots.filter((row) => !row.url.includes("example.com/tea/"))
  if (liveSnaps.length < 1) {
    throw new Error("Job wrote no live Firecrawl/CoinGecko snapshots")
  }
  const nasdaq = await Invocation.find({
    jobId: job._id,
    tool: { $in: ["price_quote", "sec_search", "sec_filing"] },
  })
  if (nasdaq.length > 0) {
    throw new Error("NASDAQ/stocks tools were invoked; this run should skip them")
  }
  results.push(
    `Job ${hex(job._id)} settled with ${liveSnaps.length} live snapshots, no NASDAQ tools`
  )
  await disconnect()
  for (const line of results) console.log(`ok  ${line}`)
  console.log("E2E passed (Firecrawl + CoinGecko + Cerebras + general job). NASDAQ skipped.")
}

main().catch(async (error) => {
  console.error("E2E failed:", error instanceof Error ? error.message : error)
  try {
    await disconnect()
  } catch {
    // ignore
  }
  process.exit(1)
})
