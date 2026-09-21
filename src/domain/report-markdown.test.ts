import { describe, expect, it } from "vitest"

import {
  isHorizontalRule,
  isTableRow,
  isTableSeparator,
  splitTableCells,
} from "@/components/report-markdown"

describe("report markdown tables", () => {
  it("splits pipe rows used in memos", () => {
    expect(
      splitTableCells(
        "| Year | Approx. Year-End Close (USD) | Approx. Market-Cap (USD) |"
      )
    ).toEqual([
      "Year",
      "Approx. Year-End Close (USD)",
      "Approx. Market-Cap (USD)",
    ])
    expect(isTableSeparator("|---|---|---|")).toBe(true)
    expect(isTableRow("| 2025 | $100,000* | $1.65 trillion |")).toBe(true)
    expect(isHorizontalRule("---")).toBe(true)
  })
})
