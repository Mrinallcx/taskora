import { readFile } from "node:fs/promises"
import path from "node:path"

import type { FilingHit, ToolResult } from "@/src/tools/types"

export async function fakeSecSearch(): Promise<ToolResult<{ filings: FilingHit[] }>> {
  const raw = await readFile(
    path.join(process.cwd(), "e2e/fixtures/apis/sec-aapl.json"),
    "utf8"
  )
  return { ok: true, data: JSON.parse(raw) as { filings: FilingHit[] } }
}

export async function fakeSecFiling(accession: string): Promise<ToolResult<{ text: string; url: string }>> {
  return {
    ok: true,
    data: {
      url: `https://www.sec.gov/Archives/edgar/data/320193/${accession}/aapl.htm`,
      text: `Apple Inc filing ${accession} tea`,
    },
  }
}
