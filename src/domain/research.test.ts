import { describe, expect, it } from "vitest"

import { rankUrlsForFetch, searchQueries } from "@/src/domain/research"

describe("in-depth research queries", () => {
  it("starts from the brief and fans out in parallel-ready queries", () => {
    const queries = searchQueries("History of the tea trade, last 20 years", {
      summary: "Cited memo on tea exports and auctions.",
    })
    expect(queries[0]).toContain("tea trade")
    expect(queries.length).toBeGreaterThanOrEqual(4)
    expect(queries.length).toBeLessThanOrEqual(8)
    expect(new Set(queries).size).toBe(queries.length)
    const year = String(new Date().getUTCFullYear())
    expect(queries.some((query) => query.includes(year))).toBe(true)
    expect(queries.some((query) => /criticism|risks|drawbacks/i.test(query))).toBe(true)
    expect(queries.join(" ")).not.toMatch(/writes the cited memo/i)
  })

  it("fans finance briefs into holders, drawdowns, and outlook queries", () => {
    const queries = searchQueries(
      "How has Bitcoin’s market changed over the last 10 years: price and market-cap path, who the main holders and venues are, what the biggest drawdowns and regulatory fights were, and what demand looks like through 2027."
    )
    expect(queries.some((query) => /holders|ETF/i.test(query))).toBe(true)
    expect(queries.some((query) => /drawdown|SEC/i.test(query))).toBe(true)
    expect(queries.some((query) => /2027/i.test(query))).toBe(true)
    expect(queries.join(" ")).not.toMatch(/architecture technology/i)
  })

  it("does not search worker boilerplate summaries", () => {
    const queries = searchQueries("Bitcoin market cap and holders", {
      summary: "Scopes, sources, writes the cited memo.",
    })
    expect(queries.some((query) => /bitcoin/i.test(query))).toBe(true)
    expect(queries.join(" ")).not.toMatch(/writes the cited memo/i)
  })

  it("drops homework and writing-guide URLs even when they are .edu", () => {
    const ranked = rankUrlsForFetch(
      [
        "https://guides.library.duke.edu/c.php?g=289484&p=1933488",
        "https://libguides.usc.edu/writingguide/assignments/policymemo",
        "https://www.ssga.com/us/en/institutional/insights/why-bitcoin-institutional-demand-is-on-the-rise",
        "https://www.coingecko.com/en/coins/bitcoin",
      ],
      4,
      "How has Bitcoin’s market changed over the last 10 years"
    )
    expect(ranked.some((url) => url.includes("coingecko"))).toBe(true)
    expect(ranked.some((url) => url.includes("ssga"))).toBe(true)
    expect(ranked.every((url) => !url.includes("libguides") && !url.includes("writingguide"))).toBe(
      true
    )
  })

  it("does not treat random .gov or Medium posts as official Bitcoin sources", () => {
    const ranked = rankUrlsForFetch(
      [
        "https://pmc.ncbi.nlm.nih.gov/articles/PMC4398561/",
        "https://beth-kindig.medium.com/the-case-for-bitcoin-to-2-million",
        "https://www.sec.gov/news/statement/gensler-bitcoin-etf",
        "https://www.coingecko.com/en/coins/bitcoin",
      ],
      4,
      "How has Bitcoin’s market changed over the last 10 years"
    )
    expect(ranked.some((url) => url.includes("sec.gov"))).toBe(true)
    expect(ranked.some((url) => url.includes("coingecko"))).toBe(true)
    expect(ranked.every((url) => !url.includes("pmc.ncbi") && !url.includes("medium.com"))).toBe(
      true
    )
  })

  it("drops price-prediction blog posts", () => {
    const ranked = rankUrlsForFetch(
      [
        "https://changenow.io/blog/eth-price-prediction",
        "https://ethereum.org/roadmap/",
        "https://www.coingecko.com/en/coins/ethereum",
      ],
      3,
      "How has Ethereum’s market changed over the last 10 years"
    )
    expect(ranked.some((url) => url.includes("ethereum.org"))).toBe(true)
    expect(ranked.every((url) => !url.includes("price-prediction"))).toBe(true)
  })

  it("ranks official hosts ahead of blogs before fetching", () => {
    const ranked = rankUrlsForFetch(
      [
        "https://random-blog.example/tea",
        "https://en.wikipedia.org/wiki/Tea",
        "https://coingecko.com/en/coins/bitcoin",
        "https://another.blog/post",
      ],
      3
    )
    expect(ranked[0]).toContain("wikipedia.org")
    expect(ranked[1]).toContain("coingecko.com")
    expect(ranked).not.toContain("https://another.blog/post")
  })
})
