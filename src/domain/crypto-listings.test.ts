import { afterEach, describe, expect, it, vi } from "vitest"

import {
  parseCoinGeckoSearch,
  resolveCryptoAssets,
  searchCrypto,
} from "./crypto-listings"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("crypto listings", () => {
  it("keeps CoinGecko search hits", () => {
    const rows = parseCoinGeckoSearch({
      coins: [
        { id: "bitcoin", name: "Bitcoin", symbol: "btc" },
        { id: "ethereum", name: "Ethereum", symbol: "eth" },
        { id: "bad", name: "", symbol: "xxx" },
      ],
    })
    expect(rows).toEqual([
      { symbol: "BTC", name: "Bitcoin", exchange: "CRYPTO" },
      { symbol: "ETH", name: "Ethereum", exchange: "CRYPTO" },
    ])
  })

  it("searches CoinGecko only", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          coins: [{ id: "bitcoin", name: "Bitcoin", symbol: "btc" }],
        }),
      }))
    )
    const rows = await searchCrypto("bit")
    expect(rows).toEqual([
      { symbol: "BTC", name: "Bitcoin", exchange: "CRYPTO" },
    ])
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        href: expect.stringContaining("api.coingecko.com/api/v3/search"),
      }),
      expect.any(Object)
    )
  })

  it("resolves a ticker from CoinGecko", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          coins: [{ id: "ethereum", name: "Ethereum", symbol: "eth" }],
        }),
      }))
    )
    const listings = await resolveCryptoAssets(["eth"])
    expect(listings).toEqual([
      { symbol: "ETH", name: "Ethereum", exchange: "CRYPTO" },
    ])
  })

  it("requires at least one coin", async () => {
    await expect(resolveCryptoAssets([])).rejects.toThrow(/at least one crypto/)
  })
})
