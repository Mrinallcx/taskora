import { describe, expect, it } from "vitest"

import { computeCoverage, isCitableTool, pickEvidenceSnapshots } from "@/src/domain/evidence"

describe("evidence snapshots", () => {
  it("drops web_search and keeps price quotes first", () => {
    const rows = [
      ...Array.from({ length: 24 }, (_, i) => ({
        id: `web-${i}`,
        toolName: "web_search",
      })),
      { id: "page", toolName: "fetch_page" },
      { id: "btc", toolName: "crypto_quote" },
    ]
    const picked = pickEvidenceSnapshots(rows, 20)
    expect(picked[0]?.id).toBe("btc")
    expect(picked.map((row) => row.id)).toEqual(["btc", "page"])
    expect(picked.every((row) => row.toolName !== "web_search")).toBe(true)
  })

  it("treats only fetched pages and price feeds as citable", () => {
    expect(isCitableTool("fetch_page")).toBe(true)
    expect(isCitableTool("crypto_quote")).toBe(true)
    expect(isCitableTool("web_search")).toBe(false)
    expect(isCitableTool("sec_search")).toBe(false)
  })

  it("counts coverage without treating snippets as pages", () => {
    expect(
      computeCoverage({
        searches: 8,
        snapshots: [
          { toolName: "web_search" },
          { toolName: "fetch_page" },
          { toolName: "crypto_quote" },
        ],
        citationIds: ["a", "a", "b"],
      })
    ).toEqual({ searches: 8, stored: 3, citable: 2, cited: 2 })
  })
})
