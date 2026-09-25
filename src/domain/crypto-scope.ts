import { NASDAQ_SEED } from "@/src/domain/stock-seed"
import { stockAliases } from "@/src/domain/stock-scope"
import type { StockListing } from "@/src/domain/stock-types"

function mentioned(text: string, aliases: string[]) {
  return aliases.some((alias) => {
    if (!alias) return false
    if (/^[a-z0-9.]{1,10}$/i.test(alias) && alias.length <= 5) {
      return new RegExp(`\\b${alias.replace(".", "\\.")}\\b`, "i").test(text)
    }
    return new RegExp(
      `\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i"
    ).test(text)
  })
}

export function briefCryptoMismatch(
  brief: string,
  instructions: string,
  selected: Pick<StockListing, "symbol" | "name">[]
) {
  const text = `${brief}\n${instructions}`.trim()
  if (selected.length === 0) return "Pick at least one crypto."

  for (const row of NASDAQ_SEED) {
    if (mentioned(text, stockAliases(row))) {
      return `This desk is crypto only. Remove ${row.symbol} from the description.`
    }
  }

  const missing = selected.filter((row) => !mentioned(text, stockAliases(row)))
  if (missing.length > 0) {
    return `Mention ${missing.map((row) => row.symbol).join(", ")} in the job description or instructions.`
  }
  return null
}
