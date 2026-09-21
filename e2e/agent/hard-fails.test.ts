import { describe, expect, it } from "vitest"

import { computeHardFails, computeVerdict } from "@/src/domain/hard-fails"

const snaps = Array.from({ length: 5 }, (_, i) => ({
  id: `s${i}`,
  url: `https://example.com/${i}`,
  text: "the history of tea",
  toolName: "fetch_page",
}))

describe("hard fails", () => {
  it("P2-EVAL-01 unknown snapshot ids fail", () => {
    const fails = computeHardFails(
      { markdown: "tea", citationIds: ["missing", "s0", "s1", "s2", "s3"] },
      { domain: "general" },
      snaps
    )
    expect(fails).toContain("citation_without_snapshot")
  })

  it("P2-HF-01 quote_not_in_snapshot", () => {
    const fails = computeHardFails(
      {
        markdown: "tea",
        citationIds: snaps.map((row) => row.id),
        citations: [
          {
            snapshotId: "s0",
            url: snaps[0].url,
            quote: "not in the stored text",
            sourceClass: "web",
          },
        ],
      },
      { domain: "general" },
      snaps
    )
    expect(fails).toContain("quote_not_in_snapshot")
  })

  it("accepts quotes taken from a markdown price table", () => {
    const table = [
      "ethereum yearly USD (CoinGecko)",
      "| Year | Start | End |",
      "| --- | --- | --- |",
      "| 2025 | $4,214 | $2,434 |",
    ].join("\n")
    const pages = [
      { id: "s0", url: "https://api.coingecko.com/chart", text: table, toolName: "crypto_quote" },
      ...snaps.slice(1),
    ]
    const fails = computeHardFails(
      {
        markdown: "ETH is $2,434 with market cap noted in the table.",
        citationIds: pages.map((row) => row.id),
        citations: [
          {
            snapshotId: "s0",
            url: pages[0].url,
            quote: "ethereum yearly USD (CoinGecko)",
            sourceClass: "price",
          },
        ],
      },
      { domain: "finance" },
      pages
    )
    expect(fails).not.toContain("quote_not_in_snapshot")
  })

  it("P3-EVAL-01 platform verdict ignores model pass", () => {
    const verdict = computeVerdict(
      {
        brief_coverage: 40,
        citation_quality: 40,
        accuracy_tells: 40,
        structure: 40,
        uncertainty: 40,
      },
      []
    )
    expect(verdict.pass).toBe(false)
  })

  it("empty markdown is a hard fail", () => {
    const fails = computeHardFails(
      { markdown: "   ", citationIds: snaps.map((row) => row.id) },
      { domain: "general" },
      snaps
    )
    expect(fails).toContain("empty_report")
  })

  it("snippet_citation fails when a SERP snapshot is cited", () => {
    const fails = computeHardFails(
      {
        markdown: "a".repeat(220),
        citationIds: ["snip", "s0", "s1", "s2", "s3"],
        citations: [
          {
            snapshotId: "snip",
            url: "https://serp.example",
            quote: "tea",
            sourceClass: "web",
          },
        ],
      },
      { domain: "general" },
      [
        ...snaps,
        {
          id: "snip",
          url: "https://serp.example",
          text: "tea",
          toolName: "web_search",
        },
      ]
    )
    expect(fails).toContain("snippet_citation")
  })
})
