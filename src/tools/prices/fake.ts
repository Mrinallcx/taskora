import { readFile } from "node:fs/promises"
import path from "node:path"

import type { PriceQuote, ToolResult } from "@/src/tools/types"

export async function fakePriceQuote(symbol: string): Promise<ToolResult<PriceQuote>> {
  const raw = await readFile(
    path.join(process.cwd(), "e2e/fixtures/apis/prices-aapl.json"),
    "utf8"
  )
  const parsed = JSON.parse(raw) as PriceQuote
  return { ok: true, data: { ...parsed, symbol: symbol.toUpperCase() } }
}
