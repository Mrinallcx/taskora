export type ExportSeries = {
  label: string
  symbol: string
  data: { month: string; price: number }[]
}

export type ExportMemoInput = {
  agentName: string
  at: Date
  brief: string
  instructions?: string
  memo: string
  citations?: { url?: string; quote?: string }[]
  series?: ExportSeries[]
  chartImage?: string
}

export function formatExportWhen(at: Date) {
  return at.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function exportFileStem(agentName: string, at: Date) {
  const slug =
    agentName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "research"
  return `taskora-${slug}-${at.toISOString().slice(0, 10)}`
}

export function chartMarkdownTable(series: ExportSeries[]) {
  if (series.length === 0) return ""
  const months = [
    ...new Set(series.flatMap((row) => row.data.map((point) => point.month))),
  ].sort()
  if (months.length === 0) return ""
  const header = `| Month | ${series.map((row) => row.symbol).join(" | ")} |`
  const rule = `| --- | ${series.map(() => "---:").join(" | ")} |`
  const rows = months.map((month) => {
    const cells = series.map((row) => {
      const point = row.data.find((item) => item.month === month)
      return point ? point.price.toFixed(2) : ""
    })
    return `| ${month} | ${cells.join(" | ")} |`
  })
  return [header, rule, ...rows].join("\n")
}

export function buildExportMarkdown(input: ExportMemoInput) {
  const name = input.agentName.trim() || "Research desk"
  const parts = [
    `# ${name}`,
    "",
    `**Taskora** by LCX  `,
    formatExportWhen(input.at),
    "",
    "## Description",
    "",
    input.brief.trim() || "—",
    "",
  ]
  if (input.instructions?.trim()) {
    parts.push("## Instructions", "", input.instructions.trim(), "")
  }
  if (input.series?.length) {
    parts.push(
      "## Chart",
      "",
      input.chartImage
        ? `![Price chart](${input.chartImage})`
        : "Price series for the selected stocks.",
      "",
      chartMarkdownTable(input.series),
      ""
    )
  }
  if (input.memo.trim()) {
    parts.push("## Memo", "", input.memo.trim(), "")
  }
  const sources = (input.citations ?? []).filter((row) => row.url)
  if (sources.length > 0) {
    parts.push("## Sources", "")
    for (const row of sources) {
      parts.push(row.quote ? `- ${row.url} — ${row.quote}` : `- ${row.url}`)
    }
    parts.push("")
  }
  parts.push("---", "", "_Exported from Taskora by LCX._", "")
  return parts.join("\n")
}
