import { describe, expect, it } from "vitest"

import { proposedFromModel, repairCitations } from "@/src/domain/citations"

const pages = Array.from({ length: 8 }, (_, i) => ({
  id: `s${i}`,
  url: `https://example.com/${i}`,
  text: `the history of tea trade source ${i}`,
  toolName: i === 0 ? "crypto_quote" : "fetch_page",
}))

describe("repair citations", () => {
  it("keeps five valid worker quotes and does not stamp the rest", () => {
    const proposed = pages.slice(0, 5).map((row) => ({
      snapshotId: row.id,
      url: row.url,
      quote: "tea",
      sourceClass: "web",
    }))
    const repaired = repairCitations(proposed, pages, 5)
    expect(repaired).toHaveLength(5)
    expect(repaired.map((row) => row.snapshotId)).toEqual(["s0", "s1", "s2", "s3", "s4"])
    expect(repaired[0]?.sourceClass).toBe("price")
  })

  it("drops invented ids and snippet snapshots", () => {
    const repaired = repairCitations(
      [
        { snapshotId: "missing", quote: "tea", url: "https://x" },
        {
          snapshotId: "snip",
          quote: "tea",
          url: "https://serp",
        },
      ],
      [...pages, { id: "snip", url: "https://serp", text: "tea snippet", toolName: "web_search" }],
      5
    )
    expect(repaired.every((row) => row.snapshotId !== "missing")).toBe(true)
    expect(repaired.every((row) => row.snapshotId !== "snip")).toBe(true)
    expect(repaired).toHaveLength(5)
  })

  it("fills from citable snapshots only when under five valid quotes", () => {
    const repaired = repairCitations(
      [{ snapshotId: "s1", quote: "tea", url: pages[1].url, sourceClass: "web" }],
      pages,
      5
    )
    expect(repaired[0]?.snapshotId).toBe("s1")
    expect(repaired).toHaveLength(5)
    expect(repaired.some((row) => row.snapshotId === "s0")).toBe(true)
  })

  it("rejects skip-to-content chrome and quotes from the page body", () => {
    const repaired = repairCitations(
      [
        {
          snapshotId: "s1",
          quote: "Skip to main content",
          url: pages[1].url,
          sourceClass: "web",
        },
      ],
      [
        {
          ...pages[1],
          text: "Skip to main content\nBitcoin demand from institutions rose after the ETF approvals.",
        },
        ...pages.filter((row) => row.id !== "s1"),
      ],
      5
    )
    expect(repaired.every((row) => !/skip to/i.test(row.quote))).toBe(true)
    expect(repaired.some((row) => /bitcoin/i.test(row.quote))).toBe(true)
  })

  it("quotes markdown bullet body text instead of treating dashes as chrome", () => {
    const repaired = repairCitations(
      [],
      [
        {
          id: "s1",
          url: "https://example.com/1",
          text: "- Bitcoin demand from institutions rose after the ETF approvals in 2024.",
          toolName: "fetch_page",
        },
        ...pages.filter((row) => row.id !== "s1"),
      ],
      5
    )
    expect(repaired.some((row) => /bitcoin demand/i.test(row.quote))).toBe(true)
  })

  it("keeps quotes from markdown tables that still appear on the page", () => {
    const table = [
      "ethereum yearly USD (CoinGecko)",
      "| Year | Start | End |",
      "| --- | --- | --- |",
      "| 2025 | $4,214 | $2,434 |",
      "Recent monthly USD close",
      "2025-09 4214.27",
    ].join("\n")
    const repaired = repairCitations(
      [],
      [
        {
          id: "s0",
          url: "https://api.coingecko.com/chart",
          text: table,
          toolName: "crypto_quote",
        },
        ...pages.slice(1),
      ],
      5
    )
    expect(repaired[0]?.quote.toLowerCase()).toContain("ethereum yearly usd")
    expect(repaired[0]?.quote).not.toContain("|")
  })

  it("merges citationIds that have no quote into the proposed list", () => {
    const proposed = proposedFromModel({
      citations: [{ snapshotId: "s1", quote: "tea", url: pages[1].url }],
      citationIds: ["s1", "s2"],
    })
    expect(proposed.map((row) => row.snapshotId)).toEqual(["s1", "s2"])
  })
})
