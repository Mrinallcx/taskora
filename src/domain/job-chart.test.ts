import { describe, expect, it } from "vitest"

import { isCryptoChartJob, tickersForJob } from "./job-chart"

describe("job chart tickers", () => {
  it("marks launch symbols as crypto on the crypto desk", () => {
    const rows = tickersForJob({
      brief: "Compare Ethereum (ETH), Solana (SOL), and LCX (LCX).",
      category: "crypto",
      symbols: [
        { symbol: "ETH", name: "Ethereum", exchange: "CRYPTO" },
        { symbol: "SOL", name: "Solana", exchange: "CRYPTO" },
        { symbol: "LCX", name: "LCX", exchange: "CRYPTO" },
      ],
    })
    expect(rows).toHaveLength(3)
    expect(rows.every((row) => row.kind === "crypto")).toBe(true)
    expect(rows.map((row) => row.symbol)).toEqual(["ETH", "SOL", "LCX"])
    expect(isCryptoChartJob({ category: "crypto" })).toBe(true)
  })

  it("keeps NASDAQ symbols on the stocks desk", () => {
    const rows = tickersForJob({
      brief: "Research Apple (AAPL).",
      category: "stocks",
      symbols: [{ symbol: "AAPL", name: "Apple Inc", exchange: "NASDAQ" }],
    })
    expect(rows).toEqual([
      { symbol: "AAPL", name: "Apple Inc", kind: "stock" },
    ])
  })
})
