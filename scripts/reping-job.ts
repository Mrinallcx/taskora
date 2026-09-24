import { loadLocalEnv } from "../src/lib/load-env"
loadLocalEnv()

import { connect } from "@/src/db/connect"
import { Job } from "@/src/db/models"
import { grokDeskForJob, handoffJobToGrokBot } from "@/src/domain/grok-bot"
import { NASDAQ_SEED } from "@/src/domain/stock-seed"

const id = process.argv[2]
if (!id) {
  console.error("usage: tsx scripts/reping-job.ts <jobId>")
  process.exit(1)
}

function listingsFromText(text: string) {
  const hay = text.toUpperCase()
  return NASDAQ_SEED.filter(
    (row) =>
      hay.includes(row.symbol) ||
      hay.includes(row.name.replace(/[^A-Za-z0-9 ]/g, "").split(" ")[0].toUpperCase())
  )
}

await connect()
const job = await Job.findById(id)
if (!job) {
  console.error("job not found")
  process.exit(1)
}

if (!job.category && (job.domain === "finance" || listingsFromText(job.brief).length)) {
  const listings = listingsFromText(`${job.brief}\n${job.instructions ?? ""}`)
  job.category = "stocks"
  if (listings.length && (!job.symbols || job.symbols.length === 0)) {
    job.symbols = listings.map((row) => ({
      symbol: row.symbol,
      name: row.name,
      exchange: row.exchange,
    }))
    job.symbol = listings[0].symbol
    job.companyName = listings[0].name
    job.exchange = listings[0].exchange
  }
  await job.save()
}

const desk = grokDeskForJob(job)
const handed = await handoffJobToGrokBot(job, desk)
console.log(
  JSON.stringify(
    {
      status: job.status,
      category: job.category,
      symbol: job.symbol,
      desk: desk.webhookUrl.includes("webhook") ? "configured" : "missing",
      pinged: handed.ping.pinged,
      pingStatus: handed.ping.status,
      pingReason: handed.ping.reason,
    },
    null,
    2
  )
)
process.exit(0)
