import type { PriceQuote, ToolResult } from "@/src/tools/types"

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
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`
  const response = await fetch(url)
  if (response.status === 401 || response.status === 403) {
    return { ok: false, code: "credential_error", message: "Prices key rejected" }
  }
  if (!response.ok) {
    return { ok: false, code: "upstream_error", message: `Alpha Vantage ${response.status}` }
  }
  const json = (await response.json()) as {
    "Monthly Time Series"?: Record<string, { "4. close"?: string }>
  }
  const series = json["Monthly Time Series"]
  if (!series) {
    return { ok: false, code: "not_found", message: "No monthly series" }
  }
  const points = Object.entries(series)
    .map(([day, row]) => [Date.parse(day), Number(row["4. close"])] as [number, number])
    .filter(([, price]) => Number.isFinite(price))
    .sort((a, b) => a[0] - b[0])
  const fiveYearsAgo = Date.now() - 5 * 365 * 24 * 60 * 60 * 1000
  const windowed = points.filter(([ts]) => ts >= fiveYearsAgo)
  if (windowed.length < 2) {
    return { ok: false, code: "not_found", message: "No monthly series" }
  }
  return { ok: true, data: { points: windowed, sourceUrl: url.split("&apikey")[0] } }
}
