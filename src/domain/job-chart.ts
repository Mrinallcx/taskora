import { resolveFinanceAsset } from "@/src/domain/finance-asset"
import { MAX_LAUNCH_STOCKS } from "@/src/domain/stock-types"

export type ChartTicker = {
  symbol: string
  name: string
  kind: "stock" | "crypto"
}

export function isCryptoChartJob(job: {
  category?: string
  symbols?: { exchange?: string }[]
}) {
  if (job.category === "crypto") return true
  const rows = job.symbols ?? []
  return (
    rows.length > 0 &&
    rows.every((row) => String(row.exchange ?? "").toUpperCase() === "CRYPTO")
  )
}

export function tickersForJob(job: {
  brief: string
  instructions?: string
  category?: string
  symbol?: string
  companyName?: string
  symbols?: { symbol?: string; name?: string; exchange?: string }[]
}): ChartTicker[] {
  const kind = isCryptoChartJob(job) ? "crypto" : "stock"
  if (Array.isArray(job.symbols) && job.symbols.some((row) => row.symbol?.trim())) {
    return job.symbols
      .filter((row) => row.symbol?.trim())
      .slice(0, MAX_LAUNCH_STOCKS)
      .map((row) => ({
        symbol: String(row.symbol).trim().toUpperCase(),
        name: String(row.name ?? row.symbol).trim(),
        kind:
          String(row.exchange ?? "").toUpperCase() === "CRYPTO" ? "crypto" : kind,
      }))
  }
  if (job.symbol?.trim()) {
    return [
      {
        symbol: job.symbol.trim().toUpperCase(),
        name: job.companyName?.trim() || job.symbol.trim(),
        kind,
      },
    ]
  }
  const asset = resolveFinanceAsset(`${job.brief}\n${job.instructions ?? ""}`)
  if (!asset) return []
  return [
    {
      symbol: asset.symbol,
      name: asset.label,
      kind: asset.kind,
    },
  ]
}
