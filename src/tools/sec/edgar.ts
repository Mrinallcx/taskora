import type { FilingHit, ToolResult } from "@/src/tools/types"

export async function edgarSearch(query: string): Promise<ToolResult<{ filings: FilingHit[] }>> {
  const ua = process.env.EDGAR_UA
  if (!ua) {
    return { ok: false, code: "credential_error", message: "EDGAR_UA is required" }
  }
  const response = await fetch(
    `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(query)}`,
    { headers: { "User-Agent": ua } }
  )
  if (!response.ok) {
    return { ok: false, code: "upstream_error", message: `EDGAR ${response.status}` }
  }
  const json = (await response.json()) as {
    hits?: { hits?: { _source?: { display_names?: string[]; file_date?: string; form?: string; adsh?: string } }[] }
  }
  const hits = json.hits?.hits ?? []
  return {
    ok: true,
    data: {
      filings: hits.slice(0, 8).map((hit) => ({
        accession: hit._source?.adsh ?? "",
        form: hit._source?.form ?? "",
        filedAt: hit._source?.file_date ?? "",
        company: hit._source?.display_names?.[0] ?? query,
        url: `https://www.sec.gov/Archives/edgar/data/${hit._source?.adsh ?? ""}`,
      })),
    },
  }
}
