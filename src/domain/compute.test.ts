import { describe, expect, it } from "vitest"

import { tokenCents, toolCents } from "@/src/domain/compute"

describe("P3-COST compute", () => {
  it("P3-COST-01 token formula is ceil of Cerebras rates", () => {
    expect(tokenCents(1_000_000, 0)).toBe(35)
    expect(tokenCents(0, 1_000_000)).toBe(75)
  })

  it("P3-COST-02 tool deltas are 1 or 2 cents", () => {
    expect(toolCents("web_search")).toBe(1)
    expect(toolCents("fetch_page")).toBe(1)
    expect(toolCents("price_quote")).toBe(2)
  })
})
