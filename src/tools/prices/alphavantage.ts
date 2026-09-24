import type { PriceQuote, ToolResult } from "@/src/tools/types"

const monthlyCache = new Map<
  string,
  { at: number; data: ToolResult<{ points: [number, number][]; sourceUrl: string }> }
>()
const MONTHLY_TTL_MS = 6 * 60 * 60 * 1000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function throttled(json: Record<string, unknown>) {
  return Boolean(json.Note || json.Information)
}

export async function alphaVantageQuote(
  symbol: string,
  apiKey: string
): Promise<ToolResult<PriceQuote>> {
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`
  const response = await fetch(url)
  if (response.status === 401 || response.status === 403) {
    return { ok: false, code: "credential_error", message: "Prices key rejected" }
  }
  if (!response.ok) {
    return { ok: false, code: "upstream_error", message: `Alpha Vantage ${response.status}` }
  }
  const json = (await response.json()) as {
    "Global Quote"?: { "05. price"?: string; "07. latest trading day"?: string }
  }
  const quote = json["Global Quote"]
  if (!quote?.["05. price"]) {
    return { ok: false, code: "not_found", message: "No quote" }
  }
  return {
    ok: true,
    data: {
      symbol: symbol.toUpperCase(),
      price: Number(quote["05. price"]),
      currency: "USD",
      asOf: quote["07. latest trading day"] ?? "",
      sourceUrl: url.split("&apikey")[0],
    },
  }
}

export async function alphaVantageMonthly(
  symbol: string,
  apiKey: string
): Promise<ToolResult<{ points: [number, number][]; sourceUrl: string }>> {
  const ticker = symbol.trim().toUpperCase()
  const hit = monthlyCache.get(ticker)
  if (hit && Date.now() - hit.at < MONTHLY_TTL_MS) return hit.data

  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY&symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`

  async function pull() {
    const response = await fetch(url)
    if (response.status === 401 || response.status === 403) {
      return { ok: false as const, code: "credential_error" as const, message: "Prices key rejected" }
    }
    if (!response.ok) {
      return { ok: false as const, code: "upstream_error" as const, message: `Alpha Vantage ${response.status}` }
    }
    const json = (await response.json()) as {
      "Monthly Time Series"?: Record<string, { "4. close"?: string }>
      Note?: string
      Information?: string
    }
    if (throttled(json)) {
      return { ok: false as const, code: "upstream_error" as const, message: "Price feed is busy" }
    }
    const series = json["Monthly Time Series"]
    if (!series) {
      return { ok: false as const, code: "not_found" as const, message: "No monthly series" }
    }
    const points = Object.entries(series)
      .map(([day, row]) => [Date.parse(day), Number(row["4. close"])] as [number, number])
      .filter(([, price]) => Number.isFinite(price))
      .sort((a, b) => a[0] - b[0])
    const fiveYearsAgo = Date.now() - 5 * 365 * 24 * 60 * 60 * 1000
    const windowed = points.filter(([ts]) => ts >= fiveYearsAgo)
    if (windowed.length < 2) {
      return { ok: false as const, code: "not_found" as const, message: "No monthly series" }
    }
    return {
      ok: true as const,
      data: { points: windowed, sourceUrl: url.split("&apikey")[0] },
    }
  }

  let result = await pull()
  if (!result.ok && result.message === "Price feed is busy") {
    await sleep(1200)
    result = await pull()
  }
  if (result.ok) monthlyCache.set(ticker, { at: Date.now(), data: result })
  return result
}
