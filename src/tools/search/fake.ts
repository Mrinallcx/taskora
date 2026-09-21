import { readFile } from "node:fs/promises"
import path from "node:path"

import type { SearchHit, ToolResult } from "@/src/tools/types"

export async function fakeSearch(query: string): Promise<ToolResult<{ hits: SearchHit[] }>> {
  const file = query.toLowerCase().includes("tea")
    ? "search-tea.json"
    : "search-default.json"
  const raw = await readFile(
    path.join(process.cwd(), "e2e/fixtures/apis", file),
    "utf8"
  )
  return { ok: true, data: JSON.parse(raw) as { hits: SearchHit[] } }
}
