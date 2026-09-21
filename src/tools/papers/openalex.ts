import type { PaperHit, ToolResult } from "@/src/tools/types"

export async function openAlexSearch(query: string): Promise<ToolResult<{ papers: PaperHit[] }>> {
  const response = await fetch(
    `https://api.openalex.org/works?search=${encodeURIComponent(query)}`
  )
  if (!response.ok) {
    return { ok: false, code: "upstream_error", message: `OpenAlex ${response.status}` }
  }
  const json = (await response.json()) as {
    results?: {
      id?: string
      display_name?: string
      doi?: string
      publication_year?: number
      ids?: { doi?: string; arxiv?: string }
    }[]
  }
  return {
    ok: true,
    data: {
      papers: (json.results ?? []).slice(0, 8).map((row) => ({
        id: row.id ?? "",
        title: row.display_name ?? "",
        doi: row.doi ?? row.ids?.doi,
        arxivId: row.ids?.arxiv,
        year: row.publication_year,
        url: row.id ?? "",
      })),
    },
  }
}
