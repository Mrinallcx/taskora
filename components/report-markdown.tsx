import type { ReactNode } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function sourceHref(label: string, href: string, byId: Map<string, string>) {
  return byId.get(label.toLowerCase()) ?? href
}

function sourceLabel(label: string) {
  return /^[a-f0-9]{24}$/i.test(label.trim()) ? "Source" : label
}

function inline(text: string, byId: Map<string, string>) {
  const parts = text.split(
    /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s)<]+|\b[a-f0-9]{24}\b)/gi
  )
  return parts.map((part, index) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/)
    if (bold) {
      return (
        <strong key={index} className="font-medium">
          {bold[1]}
        </strong>
      )
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) {
      const href = sourceHref(link[1], link[2], byId)
      return (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline-offset-2 hover:underline"
        >
          {sourceLabel(link[1])}
        </a>
      )
    }
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline-offset-2 hover:underline"
        >
          Source
        </a>
      )
    }
    if (/^[a-f0-9]{24}$/i.test(part)) {
      const href = byId.get(part.toLowerCase())
      if (href) {
        return (
          <a
            key={index}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline-offset-2 hover:underline"
          >
            Source
          </a>
        )
      }
      return <span key={index}>Source</span>
    }
    return <span key={index}>{part}</span>
  })
}

export function stripSourcesSection(text: string) {
  return text.replace(/(?:\r?\n|^)#{1,6}\s*sources\b[\s\S]*$/i, "").trimEnd()
}

export function isHorizontalRule(line: string) {
  return /^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())
}

export function isTableSeparator(line: string) {
  const trimmed = line.trim()
  if (!trimmed.includes("-")) return false
  return /^\|?[\s:|-]+\|?$/.test(trimmed) && /-{3,}/.test(trimmed)
}

export function isTableRow(line: string) {
  const trimmed = line.trim()
  if (!trimmed.includes("|")) return false
  return trimmed.startsWith("|") || trimmed.endsWith("|") || trimmed.split("|").length > 2
}

export function splitTableCells(line: string) {
  let trimmed = line.trim()
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1)
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1)
  return trimmed.split("|").map((cell) => cell.trim())
}

export function takeTable(lines: string[], start: number) {
  if (!isTableRow(lines[start] ?? "") || isTableSeparator(lines[start] ?? "")) {
    return null
  }
  const rows: string[][] = []
  let index = start
  while (index < lines.length) {
    const trimmed = lines[index].trim()
    if (!trimmed) break
    if (isHorizontalRule(trimmed)) break
    if (isTableSeparator(trimmed)) {
      index += 1
      continue
    }
    if (!isTableRow(trimmed)) break
    rows.push(splitTableCells(trimmed))
    index += 1
  }
  if (rows.length < 2) return null
  return { header: rows[0], body: rows.slice(1), next: index }
}

export function ReportMarkdown({
  text,
  citations = [],
}: {
  text: string
  citations?: { snapshotId?: string; url?: string }[]
}) {
  const byId = new Map(
    citations
      .filter((row) => row.snapshotId && row.url)
      .map((row) => [row.snapshotId!.toLowerCase(), row.url!])
  )
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const nodes: ReactNode[] = []
  let list: string[] = []

  function flushList(key: string) {
    if (list.length === 0) return
    nodes.push(
      <ul key={key} className="ml-5 list-disc space-y-1 text-sm leading-6">
        {list.map((item, index) => (
          <li key={index}>{inline(item, byId)}</li>
        ))}
      </ul>
    )
    list = []
  }

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim()
    const table = takeTable(lines, index)
    if (table) {
      flushList(`list-${index}`)
      nodes.push(
        <div
          key={`table-${index}`}
          className="border-border my-3 overflow-hidden rounded-md border"
        >
          <Table>
            <TableHeader>
              <TableRow>
                {table.header.map((cell, cellIndex) => (
                  <TableHead key={cellIndex} className="bg-muted/40 whitespace-normal">
                    {inline(cell, byId)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.body.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {table.header.map((_, cellIndex) => (
                    <TableCell key={cellIndex} className="whitespace-normal">
                      {inline(row[cellIndex] ?? "", byId)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )
      index = table.next - 1
      continue
    }
    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      list.push(trimmed.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, ""))
      continue
    }
    flushList(`list-${index}`)
    if (!trimmed || isHorizontalRule(trimmed)) continue
    if (trimmed.startsWith("#### ")) {
      nodes.push(
        <h4 key={index} className="font-heading mt-2 text-base font-medium">
          {inline(trimmed.slice(5), byId)}
        </h4>
      )
      continue
    }
    if (trimmed.startsWith("### ")) {
      nodes.push(
        <h3 key={index} className="font-heading mt-3 text-lg font-medium">
          {inline(trimmed.slice(4), byId)}
        </h3>
      )
      continue
    }
    if (trimmed.startsWith("## ")) {
      nodes.push(
        <h2 key={index} className="font-heading mt-4 text-xl">
          {inline(trimmed.slice(3), byId)}
        </h2>
      )
      continue
    }
    if (trimmed.startsWith("# ")) {
      nodes.push(
        <h1 key={index} className="font-heading text-2xl tracking-tight">
          {inline(trimmed.slice(2), byId)}
        </h1>
      )
      continue
    }
    nodes.push(
      <p key={index} className="text-sm leading-7">
        {inline(trimmed, byId)}
      </p>
    )
  }
  flushList("list-end")

  return <div className="flex flex-col gap-2">{nodes}</div>
}
