import { describe, expect, it } from "vitest"

import {
  parseListingStatusCsv,
  resolveNasdaqStocks,
  searchListings,
  seededNasdaqMatches,
} from "@/src/domain/stock-listings"
import { isNasdaqExchange, MAX_LAUNCH_STOCKS } from "@/src/domain/stock-types"

const CSV = `symbol,name,exchange,assetType,ipoDate,delistingDate,status
AAPL,Apple Inc,NASDAQ,Stock,1980-12-12,null,Active
MSFT,Microsoft Corporation,NASDAQ,Stock,1986-03-13,null,Active
JPM,JPMorgan Chase & Co,NYSE,Stock,1969-03-05,null,Active
QQQ,Invesco QQQ Trust,NASDAQ,ETF,1999-03-10,null,Active
DEAD,Old Co,NASDAQ,Stock,1990-01-01,2020-01-01,Delisted
`

describe("stock listings", () => {
  it("keeps active NASDAQ stocks only", () => {
    const rows = parseListingStatusCsv(CSV)
    expect(rows.map((row) => row.symbol)).toEqual(["AAPL", "MSFT"])
  })

  it("ranks ticker prefix ahead of name match", () => {
    const rows = parseListingStatusCsv(CSV)
    expect(searchListings(rows, "aap")[0]?.symbol).toBe("AAPL")
    expect(searchListings(rows, "micro")[0]?.symbol).toBe("MSFT")
  })

  it("finds seeded NASDAQ names without a live API", () => {
    expect(seededNasdaqMatches("AAPL")[0]?.symbol).toBe("AAPL")
    expect(seededNasdaqMatches("apple")[0]?.name).toMatch(/Apple/i)
  })

  it("treats NASDAQ suffixes as listed", () => {
    expect(isNasdaqExchange("NASDAQ")).toBe(true)
    expect(isNasdaqExchange("NASDAQ-NMS")).toBe(true)
    expect(isNasdaqExchange("NYSE")).toBe(false)
  })

  it("caps a launch at four stocks", () => {
    expect(MAX_LAUNCH_STOCKS).toBe(4)
    return expect(
      resolveNasdaqStocks(["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL"])
    ).rejects.toMatchObject({ message: /up to 4/ })
  })
})
