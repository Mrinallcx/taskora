import { describe, expect, it } from "vitest"

import { geckoId } from "./coingecko"

describe("coin gecko ids", () => {
  it("maps common tickers to CoinGecko ids", () => {
    expect(geckoId("ETH")).toBe("ethereum")
    expect(geckoId("SOL")).toBe("solana")
    expect(geckoId("LCX")).toBe("lcx")
    expect(geckoId("BTC")).toBe("bitcoin")
  })
})
