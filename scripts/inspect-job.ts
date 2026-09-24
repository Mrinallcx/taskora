import { loadLocalEnv } from "../src/lib/load-env"
loadLocalEnv()

import { connect } from "@/src/db/connect"
import { Event, Job } from "@/src/db/models"

const id = process.argv[2]
if (!id) {
  console.error("usage: tsx scripts/inspect-job.ts <jobId>")
  process.exit(1)
}

await connect()
const job = await Job.findById(id)
const events = job
  ? await Event.find({ jobId: job._id }).sort({ at: 1 })
  : []
console.log(
  JSON.stringify(
    {
      found: Boolean(job),
      status: job?.status,
      category: job?.category,
      symbol: job?.symbol,
      companyName: job?.companyName,
      symbols: job?.symbols,
      name: job?.name,
      brief: job?.brief?.slice(0, 80),
      events: events.map((row) => ({ type: row.type, payload: row.payload })),
    },
    null,
    2
  )
)
process.exit(0)
