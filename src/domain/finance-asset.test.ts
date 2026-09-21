import { describe, expect, it } from "vitest"

import { chartWindowLabel, monthRangeLabel, monthlyPrices, resolveFinanceAsset, yearlyPrices, yearlyPriceTable } from "@/src/domain/finance-asset"
import { computeHardFails } from "@/src/domain/hard-fails"

describe("finance asset", () => {
  it("resolves solana from a research brief", () => {
    const asset = resolveFinanceAsset(
      "history of solana and future growth opportunity"
    )
    expect(asset).toEqual({
      kind: "crypto",
      id: "solana",
      label: "Solana",
      symbol: "SOL",
    })
  })

  it("labels a 12 month window as one year", () => {
    const data = [
      { month: "2025-09", price: 210 },
      { month: "2026-09", price: 100 },
    ]
    expect(chartWindowLabel(data)).toBe("1 year price")
    expect(monthRangeLabel(data)).toBe("Sep 2025 – Sep 2026")
  })

  it("keeps only the last year", () => {
    const points = monthlyPrices([
      [Date.UTC(2024, 0, 1), 1],
      [Date.UTC(2025, 9, 1), 12],
      [Date.UTC(2025, 9, 20), 14],
      [Date.UTC(2026, 0, 1), 15],
    ])
    expect(points).toEqual([
      { month: "2025-10", price: 14 },
      { month: "2026-01", price: 15 },
    ])
  })

  it("builds a yearly start/end table for a decade of closes", () => {
    const points = yearlyPrices([
      [Date.UTC(2016, 0, 1), 436],
      [Date.UTC(2016, 11, 31), 960],
      [Date.UTC(2025, 0, 1), 94419],
      [Date.UTC(2025, 9, 6), 126198],
    ])
    expect(points).toEqual([
      { year: 2016, start: 436, end: 960 },
      { year: 2025, start: 94419, end: 126198 },
    ])
    expect(yearlyPriceTable("bitcoin", [
      [Date.UTC(2016, 0, 1), 436],
      [Date.UTC(2016, 11, 31), 960],
    ])).toContain("| 2016 |")
  })
})

describe("finance figures", () => {
  const snaps = Array.from({ length: 5 }, (_, i) => ({
    id: `s${i}`,
    url: `https://example.com/${i}`,
    text: "solana price rose",
    toolName: i === 0 ? "crypto_quote" : "fetch_page",
  }))
  const ids = snaps.map((row) => row.id)

  it("passes when a price citation covers figures", () => {
    const fails = computeHardFails(
      {
        markdown: "SOL is $180 with 12% growth.",
        citationIds: ids,
        citations: [
          {
            snapshotId: "s0",
            url: snaps[0].url,
            quote: "solana",
            sourceClass: "price",
          },
        ],
      },
      { domain: "finance" },
      snaps
    )
    expect(fails).not.toContain("unsourced_figure")
  })
})
