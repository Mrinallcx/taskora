import { readFile } from "node:fs/promises"
import path from "node:path"

import type { PaperHit, ToolResult } from "@/src/tools/types"

export async function fakePaperSearch(): Promise<ToolResult<{ papers: PaperHit[] }>> {
  const raw = await readFile(
    path.join(process.cwd(), "e2e/fixtures/apis/papers-transformers.json"),
    "utf8"
  )
  return { ok: true, data: JSON.parse(raw) as { papers: PaperHit[] } }
}

export async function fakePaperGet(id: string): Promise<ToolResult<{ text: string; url: string; doi?: string }>> {
  return {
    ok: true,
    data: {
      url: `https://openalex.org/${id}`,
      doi: "10.5555/fake",
      text: `Abstract for ${id}. Attention is all you need. tea`,
    },
  }
}
