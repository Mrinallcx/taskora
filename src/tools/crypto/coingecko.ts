import type { PriceQuote, ToolResult } from "@/src/tools/types"

const IDS: Record<string, string> = {
  btc: "bitcoin",
  bitcoin: "bitcoin",
  eth: "ethereum",
  ethereum: "ethereum",
  sol: "solana",
  solana: "solana",
}

function geckoId(symbol: string) {
  return IDS[symbol.trim().toLowerCase()] ?? symbol.trim().toLowerCase()
}

async function geckoGet(path: string, key: string, pro = false) {
  const base = pro
    ? "https://pro-api.coingecko.com/api/v3"
    : "https://api.coingecko.com/api/v3"
  return fetch(`${base}${path}`, {
    headers: pro ? { "x-cg-pro-api-key": key } : { "x-cg-demo-api-key": key },
  })
}

export async function coinGeckoQuote(
  symbol: string
): Promise<ToolResult<PriceQuote>> {
  const key = process.env.COINGECKO_API_KEY
  if (!key) {
    return { ok: false, code: "credential_error", message: "COINGECKO_API_KEY missing" }
  }
  const id = geckoId(symbol)
  const path = `/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_last_updated_at=true`
  const response = await geckoGet(path, key)
  if (response.status === 401 || response.status === 403) {
    return { ok: false, code: "credential_error", message: "CoinGecko key rejected" }
  }
  if (!response.ok) {
    return { ok: false, code: "upstream_error", message: `CoinGecko ${response.status}` }
  }
  const json = (await response.json()) as Record<
    string,
    { usd?: number; last_updated_at?: number }
  >
  const quote = json[id]
  if (typeof quote?.usd !== "number") {
    return { ok: false, code: "not_found", message: `No price for ${id}` }
  }
  return {
    ok: true,
    data: {
      symbol: id,
      price: quote.usd,
      currency: "USD",
      asOf: quote.last_updated_at
        ? new Date(quote.last_updated_at * 1000).toISOString()
        : new Date().toISOString(),
      sourceUrl: `https://api.coingecko.com/api/v3${path}`,
    },
  }
}

async function parseMarketChart(response: Response, id: string, path: string) {
  if (response.status === 401 || response.status === 403) {
    return {
      ok: false as const,
      code: "credential_error" as const,
      message: "CoinGecko key rejected",
    }
  }
  if (!response.ok) {
    return {
      ok: false as const,
      code: "upstream_error" as const,
      message: `CoinGecko ${response.status}`,
    }
  }
  const json = (await response.json()) as { prices?: [number, number][] }
  const prices = Array.isArray(json.prices) ? json.prices : []
  if (prices.length < 2) {
    return {
      ok: false as const,
      code: "not_found" as const,
      message: `No chart data for ${id}`,
    }
  }
  return {
    ok: true as const,
    data: { id, points: prices, sourceUrl: `https://api.coingecko.com/api/v3${path}` },
  }
}

export async function coinGeckoMarketChart(
  symbol: string,
  days: number | "max" = 365
): Promise<ToolResult<{ id: string; points: [number, number][]; sourceUrl: string }>> {
  const key = process.env.COINGECKO_API_KEY
  if (!key) {
    return { ok: false, code: "credential_error", message: "COINGECKO_API_KEY missing" }
  }
  const id = geckoId(symbol)
  const path = `/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}`
  const demo = await parseMarketChart(await geckoGet(path, key), id, path)
  if (demo.ok) return demo
  return parseMarketChart(await geckoGet(path, key, true), id, path)
}

export async function coinGeckoFiveYearChart(
  symbol: string
): Promise<
  ToolResult<{ id: string; points: [number, number][]; sourceUrl: string; provider: string }>
> {
  const chart = await coinGeckoMarketChart(geckoId(symbol), 365)
  if (!chart.ok) return chart
  return { ok: true, data: { ...chart.data, provider: "CoinGecko" } }
}
