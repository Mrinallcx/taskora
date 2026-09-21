export type FinanceAsset =
  | { kind: "crypto"; id: string; label: string; symbol: string }
  | { kind: "stock"; id: string; label: string; symbol: string }

const CRYPTO: { pattern: RegExp; id: string; label: string; symbol: string }[] = [
  { pattern: /\bsolana\b|\bsol\b/i, id: "solana", label: "Solana", symbol: "SOL" },
  { pattern: /\bbitcoin\b|\bbtc\b/i, id: "bitcoin", label: "Bitcoin", symbol: "BTC" },
  { pattern: /\bethereum\b|\beth\b/i, id: "ethereum", label: "Ethereum", symbol: "ETH" },
  { pattern: /\bdogecoin\b|\bdoge\b/i, id: "dogecoin", label: "Dogecoin", symbol: "DOGE" },
]

const STOCKS: { pattern: RegExp; id: string; label: string; symbol: string }[] = [
  { pattern: /\baapl\b|\bapple\b/i, id: "AAPL", label: "Apple", symbol: "AAPL" },
  { pattern: /\btsla\b|\btesla\b/i, id: "TSLA", label: "Tesla", symbol: "TSLA" },
  { pattern: /\bmsft\b|\bmicrosoft\b/i, id: "MSFT", label: "Microsoft", symbol: "MSFT" },
  { pattern: /\bnvda\b|\bnvidia\b/i, id: "NVDA", label: "NVIDIA", symbol: "NVDA" },
  { pattern: /\bspy\b/i, id: "SPY", label: "S&P 500", symbol: "SPY" },
]

export function resolveFinanceAsset(brief: string): FinanceAsset | null {
  const text = brief.trim()
  if (!text) return null
  for (const row of CRYPTO) {
    if (row.pattern.test(text)) {
      return { kind: "crypto", id: row.id, label: row.label, symbol: row.symbol }
    }
  }
  for (const row of STOCKS) {
    if (row.pattern.test(text)) {
      return { kind: "stock", id: row.id, label: row.label, symbol: row.symbol }
    }
  }
  return null
}

export function spanYears(series: [number, number][]) {
  if (series.length < 2) return 0
  const first = series[0][0]
  const last = series.at(-1)![0]
  return (last - first) / (365.25 * 24 * 60 * 60 * 1000)
}

export function chartWindowLabel(data: { month: string }[]) {
  if (data.length < 2) return "Price"
  const [startYear, startMonth] = data[0].month.split("-").map(Number)
  const [endYear, endMonth] = data.at(-1)!.month.split("-").map(Number)
  const months = (endYear - startYear) * 12 + (endMonth - startMonth)
  if (months >= 54) return "5 year price"
  if (months >= 18) return `${Math.round(months / 12)} year price`
  return "1 year price"
}

export function monthRangeLabel(data: { month: string }[]) {
  if (data.length === 0) return ""
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  function label(value: string) {
    const [year, month] = value.split("-")
    return `${names[Number(month) - 1] ?? month} ${year}`
  }
  if (data.length === 1) return label(data[0].month)
  return `${label(data[0].month)} – ${label(data.at(-1)!.month)}`
}

export function monthlyPrices(series: [number, number][]) {
  const cutoff = Date.now() - 370 * 24 * 60 * 60 * 1000
  const byMonth = new Map<string, number>()
  for (const [ts, price] of series) {
    if (!Number.isFinite(price) || ts < cutoff) continue
    const date = new Date(ts)
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
    byMonth.set(key, price)
  }
  return [...byMonth.entries()].map(([month, price]) => ({ month, price }))
}

/** First and last USD close observed in each calendar year. */
export function yearlyPrices(series: [number, number][]) {
  const byYear = new Map<number, { start: number; end: number }>()
  for (const [ts, price] of series) {
    if (!Number.isFinite(price)) continue
    const year = new Date(ts).getUTCFullYear()
    const prev = byYear.get(year)
    if (!prev) byYear.set(year, { start: price, end: price })
    else prev.end = price
  }
  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, row]) => ({ year, start: row.start, end: row.end }))
}

export function yearlyPriceTable(symbol: string, series: [number, number][]) {
  const rows = yearlyPrices(series)
  if (rows.length === 0) return ""
  const money = (n: number) =>
    n >= 100 ? `$${Math.round(n).toLocaleString("en-US")}` : `$${n.toFixed(2)}`
  const body = rows
    .map((row) => `| ${row.year} | ${money(row.start)} | ${money(row.end)} |`)
    .join("\n")
  return `${symbol} yearly USD (CoinGecko)\n| Year | Start | End |\n| --- | --- | --- |\n${body}`
}
