import { ApiError } from "@/src/domain/errors"
import { MAX_LAUNCH_STOCKS, type StockListing } from "@/src/domain/stock-types"

const SEARCH_TTL_MS = 10 * 60 * 1000
const searchCache = new Map<string, { at: number; rows: StockListing[] }>()
const resolvedCache = new Map<string, StockListing>()

function coinGeckoApiKey() {
  return (process.env.COINGECKO_API_KEY ?? "").trim()
}

function mergeListings(rows: StockListing[]) {
  const seen = new Set<string>()
  const unique: StockListing[] = []
  for (const row of rows) {
    if (seen.has(row.symbol)) continue
    seen.add(row.symbol)
    unique.push(row)
  }
  return unique
}

export function parseCoinGeckoSearch(json: unknown): StockListing[] {
  if (!json || typeof json !== "object") return []
  const coins = (json as { coins?: Record<string, unknown>[] }).coins
  if (!Array.isArray(coins)) return []
  const rows: StockListing[] = []
  for (const row of coins) {
    const symbol = String(row.symbol ?? "").trim().toUpperCase()
    const name = String(row.name ?? "").trim()
    if (!symbol || !name || symbol.includes(" ")) continue
    if (symbol.length > 12) continue
    rows.push({ symbol, name, exchange: "CRYPTO" })
  }
  return mergeListings(rows)
}

async function coinGeckoSearch(query: string) {
  const cached = searchCache.get(query)
  if (cached && Date.now() - cached.at < SEARCH_TTL_MS) return cached.rows
  const url = new URL("https://api.coingecko.com/api/v3/search")
  url.searchParams.set("query", query)
  const headers: Record<string, string> = {}
  const key = coinGeckoApiKey()
  if (key) headers["x-cg-demo-api-key"] = key
  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new ApiError("credential_error", "Could not search crypto.", 502)
  }
  const rows = parseCoinGeckoSearch(await response.json()).slice(0, 15)
  searchCache.set(query, { at: Date.now(), rows })
  for (const row of rows) resolvedCache.set(row.symbol, row)
  return rows
}

export async function searchCrypto(query: string) {
  const needle = query.trim()
  if (needle.length < 2) return []
  return coinGeckoSearch(needle)
}

export async function resolveCryptoAssets(symbols: string[]) {
  const unique = [
    ...new Set(
      symbols.map((row) => String(row ?? "").trim().toUpperCase()).filter(Boolean)
    ),
  ]
  if (unique.length === 0) {
    throw new ApiError("invalid", "Pick at least one crypto.")
  }
  if (unique.length > MAX_LAUNCH_STOCKS) {
    throw new ApiError("invalid", `Pick up to ${MAX_LAUNCH_STOCKS} coins.`)
  }
  const listings = []
  for (const ticker of unique) {
    listings.push(await resolveCryptoAsset(ticker))
  }
  return listings
}

export async function resolveCryptoAsset(symbol: string) {
  const ticker = symbol.trim().toUpperCase()
  if (!/^[A-Z][A-Z0-9]{1,11}$/.test(ticker)) {
    throw new ApiError("invalid", "Pick a crypto from the list.")
  }
  const known = resolvedCache.get(ticker)
  if (known) return known
  const remote = await coinGeckoSearch(ticker)
  const match = remote.find((row) => row.symbol === ticker)
  if (match) return match
  throw new ApiError("invalid", "This desk only covers crypto. Pick one from the list.")
}
