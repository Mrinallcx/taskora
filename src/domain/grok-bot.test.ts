import { afterEach, describe, expect, it } from "vitest"

import { grokDeskForJob, grokWebhookBody } from "@/src/domain/grok-bot"

const keys = [
  "GROK_BOT_WEBHOOK_URL",
  "GROK_BOT_WEBHOOK_KEY",
  "GROK_BOT_STOCKS_WEBHOOK_URL",
  "GROK_BOT_STOCKS_WEBHOOK_KEY",
  "GROK_BOT_STOCKS_2_WEBHOOK_URL",
  "GROK_BOT_STOCKS_2_WEBHOOK_KEY",
] as const

const prior = Object.fromEntries(keys.map((key) => [key, process.env[key]]))

afterEach(() => {
  for (const key of keys) {
    if (prior[key] === undefined) delete process.env[key]
    else process.env[key] = prior[key]
  }
})

describe("grok desk routing", () => {
  it("sends finance jobs to the stocks desk when that webhook is set", () => {
    process.env.GROK_BOT_STOCKS_WEBHOOK_URL = "https://example.test/stocks"
    process.env.GROK_BOT_STOCKS_WEBHOOK_KEY = "stocks-key"
    process.env.GROK_BOT_WEBHOOK_URL = "https://example.test/generic"
    process.env.GROK_BOT_WEBHOOK_KEY = "generic-key"
    expect(grokDeskForJob({ domain: "finance" }).webhookUrl).toBe(
      "https://example.test/stocks"
    )
    expect(grokDeskForJob({ category: "stocks" }).webhookUrl).toBe(
      "https://example.test/stocks"
    )
    expect(grokDeskForJob({ domain: "general" }).webhookUrl).toBe(
      "https://example.test/generic"
    )
  })

  it("sends one- and multi-ticker stock jobs to the stocks desk", () => {
    process.env.GROK_BOT_STOCKS_WEBHOOK_URL = "https://example.test/stocks"
    process.env.GROK_BOT_WEBHOOK_URL = "https://example.test/generic"
    expect(
      grokDeskForJob({
        domain: "finance",
        category: "stocks",
        symbols: [{ symbol: "AAPL" }, { symbol: "META" }],
      }).webhookUrl
    ).toBe("https://example.test/stocks")
    expect(
      grokDeskForJob({
        domain: "finance",
        category: "stocks",
        symbols: [{ symbol: "AAPL" }],
      }).webhookUrl
    ).toBe("https://example.test/stocks")
  })

  it("sends an assigned stock job to that desk", () => {
    process.env.GROK_BOT_STOCKS_WEBHOOK_URL = "https://example.test/stocks"
    process.env.GROK_BOT_STOCKS_2_WEBHOOK_URL = "https://example.test/stocks-2"
    process.env.GROK_BOT_STOCKS_2_WEBHOOK_KEY = "two"
    expect(
      grokDeskForJob({
        category: "stocks",
        workerId: "stock-2",
      })
    ).toMatchObject({
      webhookUrl: "https://example.test/stocks-2",
      webhookKey: "two",
    })
  })
})

describe("grok webhook body", () => {
  it("includes a prompt the bot can run without extra UI config", () => {
    const body = grokWebhookBody({
      jobId: "abc",
      brief: "Research Apple (AAPL) services mix.",
      callbackUrl: "https://example.test/callback",
      category: "stocks",
      symbol: "AAPL",
      companyName: "Apple Inc",
      symbols: [{ symbol: "AAPL", name: "Apple Inc", exchange: "NASDAQ" }],
    })
    expect(body.prompt).toContain("Apple (AAPL)")
    expect(body.prompt).toContain("callbackUrl")
    expect(body.text).toBe(body.prompt)
    expect(body.content).toBe(body.prompt)
    expect(body.callbackUrl).toBe("https://example.test/callback")
    expect(body.symbol).toBe("AAPL")
  })
})
