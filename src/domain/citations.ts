import { isCitableTool, isPriceTool, pickEvidenceSnapshots } from "@/src/domain/evidence"

export type RepairCitation = {
  snapshotId: string
  url: string
  quote: string
  sourceClass: "web" | "price" | "filing" | "paper"
}

export type RepairSnapshot = {
  id: string
  url: string
  text: string
  toolName?: string | null
}

export type ProposedCitation = {
  snapshotId?: string
  url?: string
  quote?: string
  sourceClass?: string
}

const CHROME =
  /skip to (main )?content|skip to navigation|close notification|cookie|accept all|sign in|log in|subscribe to|privacy policy|all rights reserved/i

export function foldQuote(text: string) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_`>|]/g, " ")
    .replace(/[’‘]/g, "'")
    .replace(/[•]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function isChromeQuote(quote: string) {
  const text = foldQuote(quote)
  if (!text) return true
  return CHROME.test(text)
}

export function quoteAppearsIn(snapshotText: string, quote: string) {
  const needle = foldQuote(quote)
  if (!needle) return false
  return foldQuote(snapshotText).includes(needle)
}

export function quoteFromSnapshot(text: string) {
  const hay = foldQuote(text)
  const lines = text.split(/\n+/).map((line) => foldQuote(line.replace(/^[-*•]+\s+/, "")))
  const line = lines.find((row) => row.length >= 24 && !isChromeQuote(row)) ?? hay
  const quote = line.slice(0, 80)
  if (quote && hay.includes(quote)) return quote
  return hay.slice(0, 80)
}

function sourceClassOf(snap: RepairSnapshot, proposed?: string): RepairCitation["sourceClass"] {
  if (isPriceTool(snap.toolName)) return "price"
  if (snap.toolName === "sec_filing") return "filing"
  if (snap.toolName === "paper_get") return "paper"
  if (proposed === "price" || proposed === "filing" || proposed === "paper" || proposed === "web") {
    return proposed
  }
  return "web"
}

function quoteMatches(snap: RepairSnapshot, quote: string) {
  return quoteAppearsIn(snap.text, quote)
}

export function repairCitations(
  proposed: ProposedCitation[],
  snapshots: RepairSnapshot[],
  min = 5
): RepairCitation[] {
  const byId = new Map(snapshots.map((row) => [row.id, row]))
  const kept: RepairCitation[] = []
  const seen = new Set<string>()

  for (const row of proposed) {
    const id = row.snapshotId
    if (!id || seen.has(id)) continue
    const snap = byId.get(id)
    if (!snap || !isCitableTool(snap.toolName)) continue
    if (isChromeQuote(row.quote ?? "")) continue
    if (!quoteMatches(snap, row.quote ?? "")) continue
    seen.add(id)
    kept.push({
      snapshotId: id,
      url: snap.url,
      quote: foldQuote(row.quote ?? ""),
      sourceClass: sourceClassOf(snap, row.sourceClass),
    })
  }

  if (kept.length >= min) return kept

  for (const snap of pickEvidenceSnapshots(snapshots)) {
    if (kept.length >= min) break
    if (seen.has(snap.id) || !isCitableTool(snap.toolName)) continue
    const quote = quoteFromSnapshot(snap.text)
    if (!quote || isChromeQuote(quote) || !quoteAppearsIn(snap.text, quote)) continue
    seen.add(snap.id)
    kept.push({
      snapshotId: snap.id,
      url: snap.url,
      quote,
      sourceClass: sourceClassOf(snap),
    })
  }

  return kept
}

export function proposedFromModel(parsed: {
  citations?: ProposedCitation[]
  citationIds?: string[]
}): ProposedCitation[] {
  const citations = Array.isArray(parsed.citations) ? parsed.citations : []
  const ids = Array.isArray(parsed.citationIds) ? parsed.citationIds : []
  const seen = new Set(citations.map((row) => row.snapshotId).filter(Boolean))
  const extra = ids
    .filter((id) => id && !seen.has(id))
    .map((snapshotId) => ({ snapshotId, url: "", quote: "" }))
  return [...citations, ...extra]
}
