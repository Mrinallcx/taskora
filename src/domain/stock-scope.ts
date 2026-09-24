import { NASDAQ_SEED } from "@/src/domain/stock-seed"
import type { StockListing } from "@/src/domain/stock-types"

const CRYPTO = [
  { label: "Bitcoin", pattern: /\bbitcoin\b|\bbtc\b/i },
  { label: "Ethereum", pattern: /\bethereum\b|\beth\b/i },
  { label: "Solana", pattern: /\bsolana\b|\bsol\b/i },
  { label: "Dogecoin", pattern: /\bdogecoin\b|\bdoge\b/i },
]

const LEGAL = /\b(inc|incorporated|corporation|corp|company|co|ltd|class [a-c])\b/gi

function cleanName(name: string) {
  return name.replace(LEGAL, "").replace(/\s+/g, " ").trim()
}

export function stockAliases(row: { symbol: string; name: string }) {
  const aliases = new Set<string>([row.symbol.toLowerCase()])
  const cleaned = cleanName(row.name)
  if (cleaned) aliases.add(cleaned.toLowerCase())
  const parts = cleaned.split(" ").filter(Boolean)
  if (parts.length === 1 && parts[0].length >= 3) {
    aliases.add(parts[0].toLowerCase())
  } else if (parts.length === 2 && parts[0].length >= 4) {
    aliases.add(parts[0].toLowerCase())
  }
  return [...aliases]
}

function mentioned(text: string, aliases: string[]) {
  return aliases.some((alias) => {
    if (!alias) return false
    if (/^[a-z0-9.]{1,10}$/i.test(alias) && alias.length <= 5) {
      return new RegExp(`\\b${alias.replace(".", "\\.")}\\b`, "i").test(text)
    }
    return new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(
      text
    )
  })
}

export function briefStockMismatch(
  brief: string,
  instructions: string,
  selected: Pick<StockListing, "symbol" | "name">[]
) {
  const text = `${brief}\n${instructions}`.trim()
  if (selected.length === 0) return "Pick at least one NASDAQ-listed stock."

  for (const row of CRYPTO) {
    if (row.pattern.test(text)) {
      return `This desk is NASDAQ stocks only. Remove ${row.label} from the description.`
    }
  }

  const allowed = new Set(
    selected.flatMap((row) => stockAliases(row).map((alias) => alias.toLowerCase()))
  )
  const allowedSymbols = new Set(selected.map((row) => row.symbol.toUpperCase()))

  const known = new Map<string, string>()
  for (const row of [...NASDAQ_SEED, ...selected, { symbol: "SPY", name: "S&P 500" }]) {
    for (const alias of stockAliases(row)) {
      if (!known.has(alias)) known.set(alias, row.symbol.toUpperCase())
    }
  }

  const extras = new Set<string>()
  for (const [alias, symbol] of known) {
    if (allowed.has(alias) || allowedSymbols.has(symbol)) continue
    if (mentioned(text, [alias])) extras.add(symbol)
  }
  if (extras.size > 0) {
    return `The description mentions ${[...extras].join(", ")}, which you did not select. Add ${[...extras].join(", ")} or remove ${extras.size === 1 ? "it" : "them"} from the text.`
  }

  const missing = selected.filter(
    (row) => !mentioned(text, stockAliases(row))
  )
  if (missing.length > 0) {
    return `Mention ${missing.map((row) => row.symbol).join(", ")} in the job description or instructions.`
  }
  return null
}
