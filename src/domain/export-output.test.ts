import { describe, expect, it } from "vitest"
import { buildExportMarkdown, chartMarkdownTable, exportFileStem } from "./export-output"

describe("export-output", () => {
  it("builds a branded markdown memo with a price table", () => {
    const md = buildExportMarkdown({
      agentName: "Equity desk",
      at: new Date("2026-04-02T15:04:00Z"),
      brief: "Compare Apple and Microsoft.",
      instructions: "Focus on growth vs valuation.",
      memo: "Apple is more expensive on multiples.",
      citations: [{ url: "https://example.com/filing", quote: "10-K" }],
      series: [
        {
          label: "Apple",
          symbol: "AAPL",
          data: [
            { month: "2025-12", price: 270.1 },
            { month: "2026-01", price: 280 },
          ],
        },
        {
          label: "Microsoft",
          symbol: "MSFT",
          data: [{ month: "2026-01", price: 410.5 }],
        },
      ],
    })
    expect(md).toContain("# Equity desk")
    expect(md).toContain("**Taskora** by LCX")
    expect(md).toContain("## Description")
    expect(md).toContain("Compare Apple and Microsoft.")
    expect(md).toContain("## Instructions")
    expect(md).toContain("Focus on growth vs valuation.")
    expect(md).toContain("## Memo")
    expect(md).toContain("Apple is more expensive on multiples.")
    expect(md).toContain("| Month | AAPL | MSFT |")
    expect(md).toContain("| 2026-01 | 280.00 | 410.50 |")
    expect(md).toContain("https://example.com/filing")
    expect(md).toContain("Exported from Taskora by LCX")
  })

  it("embeds a chart image when provided", () => {
    const md = buildExportMarkdown({
      agentName: "Desk",
      at: new Date("2026-04-02T15:04:00Z"),
      brief: "Brief",
      memo: "Memo",
      series: [{ label: "Apple", symbol: "AAPL", data: [{ month: "2026-01", price: 1 }] }],
      chartImage: "data:image/png;base64,abc",
    })
    expect(md).toContain("![Price chart](data:image/png;base64,abc)")
  })

  it("builds a download stem from the agent name", () => {
    expect(exportFileStem("Apple vs Microsoft", new Date("2026-04-02T15:04:00Z"))).toBe(
      "taskora-apple-vs-microsoft-2026-04-02"
    )
  })

  it("aligns sparse series on the same months", () => {
    expect(
      chartMarkdownTable([
        { label: "A", symbol: "AAA", data: [{ month: "2026-01", price: 1 }] },
        { label: "B", symbol: "BBB", data: [{ month: "2026-02", price: 2 }] },
      ])
    ).toBe(
      [
        "| Month | AAA | BBB |",
        "| --- | ---: | ---: |",
        "| 2026-01 | 1.00 |  |",
        "| 2026-02 |  | 2.00 |",
      ].join("\n")
    )
  })
})
