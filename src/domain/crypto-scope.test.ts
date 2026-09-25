import { describe, expect, it } from "vitest"

import { briefCryptoMismatch } from "./crypto-scope"

const bitcoin = { symbol: "BTC", name: "Bitcoin" }
const ether = { symbol: "ETH", name: "Ethereum" }

describe("brief crypto scope", () => {
  it("accepts a brief that names the selected coin", () => {
    expect(
      briefCryptoMismatch("Research Bitcoin over the last 24 months", "", [
        bitcoin,
      ])
    ).toBeNull()
  })

  it("requires every selected coin in the text", () => {
    expect(
      briefCryptoMismatch("Bitcoin only", "", [bitcoin, ether])
    ).toMatch(/ETH/)
  })

  it("rejects stocks on the crypto desk", () => {
    expect(
      briefCryptoMismatch("Bitcoin and Apple treasury", "", [bitcoin])
    ).toMatch(/AAPL/)
  })
})
