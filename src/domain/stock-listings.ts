import { ApiError } from "@/src/domain/errors"
import { NASDAQ_SEED } from "@/src/domain/stock-seed"
import {
  isNasdaqExchange,
  MAX_LAUNCH_STOCKS,
  type StockListing,
} from "@/src/domain/stock-types"

export type { LaunchCategory, StockListing } from "@/src/domain/stock-types"
export {
  LAUNCH_CATEGORIES,
  MAX_LAUNCH_STOCKS,
  isLaunchCategory,
  isNasdaqExchange,
} from "@/src/domain/stock-types"

const SEARCH_TTL_MS = 10 * 60 * 1000
const searchCache = new Map<string, { at: number; rows: StockListing[] }>()
const resolvedCache = new Map<string, StockListing>()

export function alphaVantageApiKey() {
  return (
    process.env.ALPHAVANTAGE_API_KEY?.trim() ||
    process.env.PRICES_API_KEY?.trim() ||
    ""
  )
}

function alphaUrl(params: Record<string, string>) {
  const url = new URL("https://www.alphavantage.co/query")
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url
}

function parseCsvLine(line: string) {
  const cells: string[] = []
  let current = ""
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"'
        i += 1
        continue
      }
      quoted = !quoted
      continue
    }
    if (char === "," && !quoted) {
      cells.push(current)
      current = ""
      continue
    }
    current += char
  }
  cells.push(current)
  return cells
}

export function parseListingStatusCsv(csv: string): StockListing[] {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return []
  const header = parseCsvLine(lines[0]).map((cell) => cell.trim().toLowerCase())
  const symbolAt = header.indexOf("symbol")
  const nameAt = header.indexOf("name")
  const exchangeAt = header.indexOf("exchange")
  const typeAt = header.indexOf("assettype")
  const statusAt = header.indexOf("status")
  if (symbolAt < 0 || nameAt < 0 || exchangeAt < 0) return []
  const rows: StockListing[] = []
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line)
    const symbol = String(cells[symbolAt] ?? "").trim().toUpperCase()
    const name = String(cells[nameAt] ?? "").trim()
    const exchange = String(cells[exchangeAt] ?? "").trim()
    const assetType = String(cells[typeAt] ?? "").trim()
    const status = String(cells[statusAt] ?? "Active").trim()
    if (!symbol || !name) continue
    if (status && status.toLowerCase() !== "active") continue
    if (assetType && !/^stock$/i.test(assetType)) continue
    if (!isNasdaqExchange(exchange)) continue
    rows.push({ symbol, name, exchange: "NASDAQ" })
  }
  return rows
}

export function seededNasdaqMatches(query: string) {
  return searchListings(NASDAQ_SEED, query)
}

export function searchListings(rows: StockListing[], query: string) {
  const needle = query.trim().toLowerCase()
  if (needle.length < 1) return []
  const scored = rows
    .map((row) => {
      const symbol = row.symbol.toLowerCase()
      const name = row.name.toLowerCase()
      let score = 0
      if (symbol === needle) score = 100
      else if (symbol.startsWith(needle)) score = 80
      else if (name.startsWith(needle)) score = 70
      else if (name.includes(needle) || symbol.includes(needle)) score = 40
      return { row, score }
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.row.symbol.localeCompare(b.row.symbol))
  return scored.slice(0, 15).map((hit) => hit.row)
}

function mergeListings(...groups: StockListing[][]) {
  const seen = new Set<string>()
  const rows: StockListing[] = []
  for (const group of groups) {
    for (const row of group) {
      if (seen.has(row.symbol)) continue
      seen.add(row.symbol)
      rows.push(row)
    }
  }
  return rows
}

function parseSymbolSearch(json: unknown): StockListing[] {
  if (!json || typeof json !== "object") return []
  const matches = (json as { bestMatches?: Record<string, string>[] }).bestMatches
  if (!Array.isArray(matches)) return []
  const rows: StockListing[] = []
  for (const row of matches) {
    const symbol = String(row["1. symbol"] ?? "").trim().toUpperCase()
    const name = String(row["2. name"] ?? "").trim()
    const type = String(row["3. type"] ?? "").trim()
    const region = String(row["4. region"] ?? "").trim()
    if (!symbol || !name || symbol.includes(".")) continue
    if (!/^united states$/i.test(region)) continue
    if (type && !/equity|stock/i.test(type)) continue
    rows.push({ symbol, name, exchange: "NASDAQ" })
  }
  return rows
}

async function symbolSearchFallback(query: string) {
  const apiKey = alphaVantageApiKey()
  if (!apiKey) {
    throw new ApiError(
      "credential_error",
      "ALPHAVANTAGE_API_KEY is not set.",
      503
    )
  }
  const cached = searchCache.get(query)
  if (cached && Date.now() - cached.at < SEARCH_TTL_MS) return cached.rows
  const url = alphaUrl({
    function: "SYMBOL_SEARCH",
    keywords: query,
    apikey: apiKey,
  })
  const response = await fetch(url)
  if (!response.ok) {
    throw new ApiError("credential_error", "Could not search stocks.", 502)
  }
  const json = (await response.json()) as Record<string, unknown>
  if (json.Note || json.Information || json["Error Message"]) {
    throw new ApiError(
      "rate_limited",
      "Stock search hit the Alpha Vantage limit. Use a listed ticker like AAPL, or wait a minute.",
      429
    )
  }
  const rows = parseSymbolSearch(json)
  searchCache.set(query, { at: Date.now(), rows })
  for (const row of rows) resolvedCache.set(row.symbol, row)
  return rows
}

export async function searchNasdaqStocks(query: string) {
  const needle = query.trim()
  if (needle.length < 2) return []
  const local = seededNasdaqMatches(needle)
  for (const row of local) resolvedCache.set(row.symbol, row)
  const exact = local.some(
    (row) => row.symbol.toLowerCase() === needle.toLowerCase()
  )
  if (exact) return local
  try {
    const remote = await symbolSearchFallback(needle)
    return mergeListings(local, remote).slice(0, 15)
  } catch (error) {
    if (local.length > 0) return local
    throw error
  }
}

async function overviewListing(symbol: string): Promise<StockListing | null> {
  const apiKey = alphaVantageApiKey()
  if (!apiKey) return null
  const url = alphaUrl({
    function: "OVERVIEW",
    symbol,
    apikey: apiKey,
  })
  const response = await fetch(url)
  if (!response.ok) return null
  const json = (await response.json()) as Record<string, unknown>
  if (json.Note || json.Information || !json.Symbol) return null
  const exchange = String(json.Exchange ?? "")
  const country = String(json.Country ?? "")
  const assetType = String(json.AssetType ?? "")
  if (!isNasdaqExchange(exchange)) return null
  if (country && !/usa|united states/i.test(country)) return null
  if (assetType && !/stock/i.test(assetType)) return null
  return {
    symbol: String(json.Symbol).toUpperCase(),
    name: String(json.Name ?? json.Symbol),
    exchange: "NASDAQ",
  }
}

export async function resolveNasdaqStocks(symbols: string[]) {
  const unique = [
    ...new Set(
      symbols.map((row) => String(row ?? "").trim().toUpperCase()).filter(Boolean)
    ),
  ]
  if (unique.length === 0) {
    throw new ApiError(
      "invalid",
      "Pick at least one NASDAQ-listed US stock."
    )
  }
  if (unique.length > MAX_LAUNCH_STOCKS) {
    throw new ApiError("invalid", `Pick up to ${MAX_LAUNCH_STOCKS} NASDAQ stocks.`)
  }
  const listings = []
  for (const ticker of unique) {
    listings.push(await resolveNasdaqStock(ticker))
  }
  return listings
}

export async function resolveNasdaqStock(symbol: string) {
  if (!alphaVantageApiKey()) {
    throw new ApiError(
      "credential_error",
      "ALPHAVANTAGE_API_KEY is not set.",
      503
    )
  }
  const ticker = symbol.trim().toUpperCase()
  if (!/^[A-Z][A-Z0-9.]{0,9}$/.test(ticker)) {
    throw new ApiError(
      "invalid",
      "Pick a NASDAQ-listed US stock from the list."
    )
  }
  const known =
    resolvedCache.get(ticker) ||
    NASDAQ_SEED.find((row) => row.symbol === ticker)
  if (known) return known
  const overview = await overviewListing(ticker)
  if (overview) return overview
  throw new ApiError(
    "invalid",
    "This desk only covers NASDAQ-listed US stocks. Pick one from the list."
  )
}
