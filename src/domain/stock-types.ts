export type StockListing = {
  symbol: string
  name: string
  exchange: string
}

export type LaunchCategory = "stocks" | "crypto"

export const MAX_LAUNCH_STOCKS = 4

export const LAUNCH_CATEGORIES: { id: LaunchCategory; label: string }[] = [
  { id: "stocks", label: "Stocks" },
  { id: "crypto", label: "Crypto" },
]

export function isLaunchCategory(value: unknown): value is LaunchCategory {
  return value === "stocks" || value === "crypto"
}

export function isNasdaqExchange(exchange: string) {
  return /^NASDAQ/i.test(exchange.trim())
}
