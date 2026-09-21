import { isCitableTool } from "@/src/domain/evidence"
import { quoteAppearsIn } from "@/src/domain/citations"

export type Citation = {
  snapshotId?: string
  url: string
  quote?: string
  sourceClass: "web" | "filing" | "price" | "paper"
  doi?: string
  arxivId?: string
  accession?: string
}

export type Snapshot = {
  id: string
  url: string
  text: string
  toolName?: string | null
}

const FIGURE =
  /(?:\$[\d,]+(?:\.\d+)?|\d+(?:\.\d+)?\s?%|\bmarket[\s-]?cap\b)/i

function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim()
}

export function computeHardFails(
  report: { markdown: string; citationIds: string[]; citations?: Citation[] },
  job: { domain: string },
  snapshots: Snapshot[]
) {
  const fails: string[] = []
  const byId = new Map(snapshots.map((row) => [row.id, row]))
  const cited = [...new Set(report.citationIds)]
  const citableCited = cited.filter((id) => isCitableTool(byId.get(id)?.toolName))

  for (const id of cited) {
    if (!byId.has(id)) fails.push("citation_without_snapshot")
    else if (!isCitableTool(byId.get(id)?.toolName)) fails.push("snippet_citation")
  }

  for (const citation of report.citations ?? []) {
    if (!citation.snapshotId || !byId.has(citation.snapshotId)) {
      fails.push("citation_without_snapshot")
      continue
    }
    const snap = byId.get(citation.snapshotId)!
    if (!isCitableTool(snap.toolName)) {
      fails.push("snippet_citation")
      continue
    }
    if (citation.quote) {
      if (!quoteAppearsIn(snap.text, citation.quote)) {
        fails.push("quote_not_in_snapshot")
      }
    }
    if (job.domain === "academic" && !citation.doi && !citation.arxivId) {
      fails.push("missing_paper_id")
    }
  }

  if (!normalize(report.markdown) || normalize(report.markdown).length < 200) {
    fails.push("empty_report")
  }

  if (citableCited.length < 5) fails.push("too_few_sources")

  if (job.domain === "finance" && FIGURE.test(report.markdown)) {
    const priced = (report.citations ?? []).some((row) => row.sourceClass === "price")
    if (!priced) fails.push("unsourced_figure")
  }

  return [...new Set(fails)]
}

export type Scores = {
  brief_coverage: number
  citation_quality: number
  accuracy_tells: number
  structure: number
  uncertainty: number
}

export function weightedScore(scores: Scores) {
  return (
    scores.brief_coverage * 0.25 +
    scores.citation_quality * 0.25 +
    scores.accuracy_tells * 0.25 +
    scores.structure * 0.15 +
    scores.uncertainty * 0.1
  )
}

export function computeVerdict(scores: Scores, hardFails: string[]) {
  const pass = hardFails.length === 0 && weightedScore(scores) >= 75
  return { pass, scores, hardFails }
}
