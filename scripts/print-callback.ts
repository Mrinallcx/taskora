import { loadLocalEnv } from "../src/lib/load-env"
loadLocalEnv()

import { grokCallbackUrl } from "@/src/domain/grok-bot"

const jobId = process.argv[2]
if (!jobId) {
  console.error("usage: tsx scripts/print-callback.ts <jobId>")
  process.exit(1)
}

console.log(grokCallbackUrl(jobId))
process.exit(0)
