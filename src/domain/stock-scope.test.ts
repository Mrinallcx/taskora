import { describe, expect, it } from "vitest"

import { briefStockMismatch } from "@/src/domain/stock-scope"

const apple = { symbol: "AAPL", name: "Apple Inc" }
const micro = { symbol: "MSFT", name: "Microsoft Corporation" }

describe("brief stock scope", () => {
  it("accepts a brief that names the selected stock", () => {
    expect(
      briefStockMismatch("Apple services mix since 2020", "", [apple])
    ).toBeNull()
  })

  it("requires every selected ticker in the text", () => {
    expect(
      briefStockMismatch("Apple earnings only", "", [apple, micro])
    ).toMatch(/MSFT/)
  })

  it("rejects a stock that was not selected", () => {
    expect(
      briefStockMismatch("Apple vs Tesla demand", "", [apple])
    ).toMatch(/TSLA/)
  })

  it("rejects crypto on the stocks desk", () => {
    expect(
      briefStockMismatch("Apple and bitcoin treasury", "", [apple])
    ).toMatch(/Bitcoin/)
  })
})
