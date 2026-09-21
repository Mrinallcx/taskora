export const PRICE_TOOLS = new Set(["crypto_quote", "price_quote"])

export const CITABLE_TOOLS = new Set([
  "fetch_page",
  "crypto_quote",
  "price_quote",
  "custom_api",
  "sec_filing",
  "paper_get",
])

export function isPriceTool(toolName?: string | null) {
  return PRICE_TOOLS.has(String(toolName ?? ""))
}

export function isCitableTool(toolName?: string | null) {
  return CITABLE_TOOLS.has(String(toolName ?? ""))
}

/** Price snapshots first so finance figures can cite CoinGecko / quotes. Drops SERP snippets. */
export function pickEvidenceSnapshots<T extends { toolName?: string | null }>(
  rows: T[],
  limit = 20
) {
  const citable = rows.filter((row) => isCitableTool(row.toolName))
  const priced = citable.filter((row) => isPriceTool(row.toolName))
  const rest = citable.filter((row) => !isPriceTool(row.toolName))
  return [...priced, ...rest].slice(0, Math.max(0, limit))
}

export function computeCoverage(input: {
  searches: number
  snapshots: { toolName?: string | null }[]
  citationIds: string[]
}) {
  return {
    searches: input.searches,
    stored: input.snapshots.length,
    citable: input.snapshots.filter((row) => isCitableTool(row.toolName)).length,
    cited: [...new Set(input.citationIds.filter(Boolean))].length,
  }
}
