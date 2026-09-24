import { describe, expect, it } from "vitest"

import { PLATFORM_LISTINGS } from "./platform-seed"

describe("platform seed", () => {
  it("covers the listings production needs to boot", () => {
    expect(PLATFORM_LISTINGS.map((row) => row.slug)).toEqual([
      "lead-research",
      "worker-research",
      "eval-research",
      "research-handoff",
    ])
  })
})
