import { readFileSync } from "node:fs"

import { loadLocalEnv } from "../src/lib/load-env"
loadLocalEnv()

import { applyGrokBotMemo } from "@/src/domain/grok-bot"

const jobId = process.argv[2]
const file = process.argv[3]
if (!jobId || !file) {
  console.error("usage: tsx scripts/apply-memo.ts <jobId> <memo.md>")
  process.exit(1)
}

const markdown = readFileSync(file, "utf8").trim()
if (!markdown) {
  console.error("memo file is empty")
  process.exit(1)
}

const result = await applyGrokBotMemo(jobId, { markdown })
console.log(
  JSON.stringify(
    {
      id: jobId,
      status: result.job.status,
      chars: result.markdown.length,
    },
    null,
    2
  )
)
process.exit(0)
