import { describe, expect, it } from "vitest"

import {
  groupLaunchedAgents,
  launchedAgentBySlug,
  launchedAgentHref,
  launchedAgentSlug,
  launchedTaskFromJob,
  summarizeLaunchedAgents,
} from "@/src/domain/launched-agents"

describe("launched agents", () => {
  it("groups jobs by agent name and ignores unnamed runs", () => {
    const groups = groupLaunchedAgents([
      { name: "Apple Stocks Agent", createdAt: new Date("2026-09-23") },
      { name: "apple stocks agent", createdAt: new Date("2026-09-22") },
      { name: "  ", createdAt: new Date("2026-09-21") },
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBe("Apple Stocks Agent")
    expect(groups[0].tasks).toHaveLength(2)
    expect(groups[0].slug).toBe("apple-stocks-agent")
  })

  it("resolves an agent page slug", () => {
    expect(launchedAgentSlug("Apple Stocks Agent")).toBe("apple-stocks-agent")
    expect(launchedAgentHref("Apple Stocks Agent")).toBe(
      "/dashboard/agent/apple-stocks-agent"
    )
    const found = launchedAgentBySlug(
      [{ name: "Apple Stocks Agent" }],
      "apple-stocks-agent"
    )
    expect(found?.name).toBe("Apple Stocks Agent")
    expect(launchedAgentBySlug([{ name: "Apple Stocks Agent" }], "missing")).toBeNull()
  })

  it("summarizes agents for the launch form", () => {
    const rows = summarizeLaunchedAgents([
      {
        name: "Apple desk",
        category: "stocks",
        symbol: "AAPL",
        companyName: "Apple Inc",
        exchange: "NASDAQ",
        symbols: [{ symbol: "AAPL", name: "Apple Inc", exchange: "NASDAQ" }],
      },
    ])
    expect(rows).toEqual([
      {
        name: "Apple desk",
        slug: "apple-desk",
        taskCount: 1,
        category: "stocks",
        symbols: [{ symbol: "AAPL", name: "Apple Inc", exchange: "NASDAQ" }],
      },
    ])
  })

  it("flattens a job for client task cards", () => {
    const row = launchedTaskFromJob({
      _id: { toString: () => "job-1" },
      name: "Apple desk",
      domain: "finance",
      brief: "Compare Apple and NVIDIA",
      status: "delivered",
      createdAt: new Date("2026-09-24T00:00:00.000Z"),
      category: "stocks",
      symbols: [{ symbol: "AAPL", name: "Apple Inc" }],
      workerId: "stock-1",
    })
    expect(row._id).toBe("job-1")
    expect(row.status).toBe("delivered")
    expect(row.createdAt).toBe("2026-09-24T00:00:00.000Z")
    expect(row.symbols).toEqual([{ symbol: "AAPL", name: "Apple Inc" }])
  })
})
