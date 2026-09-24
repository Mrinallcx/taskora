import { describe, expect, it } from "vitest"
import {
  extractTokenUsage,
  formatResponseTime,
  jobRunStats,
} from "./job-run-stats"

describe("job-run-stats", () => {
  it("reads common usage shapes from a callback body", () => {
    expect(
      extractTokenUsage({
        usage: { prompt_tokens: 1200, completion_tokens: 400, total_tokens: 1600 },
      })
    ).toEqual({ inputTokens: 1200, outputTokens: 400, totalTokens: 1600 })
    expect(extractTokenUsage({ inputTokens: 10, outputTokens: 5 })).toEqual({
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
    })
    expect(extractTokenUsage({ markdown: "hello" })).toBeNull()
  })

  it("measures response time from dispatch to delivery", () => {
    const stats = jobRunStats({
      createdAt: "2026-09-23T13:00:00.000Z",
      deliveredAt: "2026-09-23T13:04:12.000Z",
      events: [
        { type: "grok_bot_dispatched", at: "2026-09-23T13:00:05.000Z" },
        {
          type: "grok_bot_completed",
          at: "2026-09-23T13:04:12.000Z",
          payload: { usage: { input_tokens: 800, output_tokens: 200 } },
        },
      ],
    })
    expect(stats.responseMs).toBe(247_000)
    expect(stats.inputTokens).toBe(800)
    expect(stats.outputTokens).toBe(200)
    expect(stats.totalTokens).toBe(1000)
    expect(formatResponseTime(stats.responseMs ?? 0)).toBe("4m 7s")
  })

  it("leaves tokens empty when the bot did not send usage", () => {
    const stats = jobRunStats({
      createdAt: "2026-09-23T13:00:00.000Z",
      deliveredAt: "2026-09-23T13:01:00.000Z",
    })
    expect(stats.responseMs).toBe(60_000)
    expect(stats.inputTokens).toBeNull()
    expect(stats.totalTokens).toBeNull()
  })
})
