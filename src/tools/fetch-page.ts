import { createHash } from "node:crypto"

import { Snapshot } from "@/src/db/models"
import { extractText } from "@/src/tools/html"
import { fetchValidated, type LookupFn, type TransportFn } from "@/src/tools/ssrf"
import type { ToolResult } from "@/src/tools/types"

export async function fetchPage(
  jobId: unknown,
  url: string,
  opts: { lookupFn?: LookupFn; transport?: TransportFn } = {}
): Promise<ToolResult<{ snapshotId: string; url: string; text: string; sha256: string }>> {
  const fetched = await fetchValidated(url, opts)
  if (!fetched.ok) {
    return { ok: false, code: fetched.code, message: fetched.message }
  }
  const text = extractText(fetched.body.toString("utf8"))
  const sha256 = createHash("sha256").update(text).digest("hex")
  const row = await Snapshot.findOneAndUpdate(
    { jobId, url: fetched.url },
    {
      jobId,
      url: fetched.url,
      text,
      sha256,
      toolName: "fetch_page",
      retrievedAt: new Date(),
    },
    { upsert: true, returnDocument: "after" }
  )
  return {
    ok: true,
    data: {
      snapshotId: String(row._id),
      url: fetched.url,
      text,
      sha256,
    },
  }
}
