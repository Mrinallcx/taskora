import { jsPDF } from "jspdf"

import {
  type ExportMemoInput,
  exportFileStem,
  formatExportWhen,
} from "@/src/domain/export-output"

const NAVY: [number, number, number] = [12, 28, 68]
const BLUE: [number, number, number] = [43, 107, 255]
const INK: [number, number, number] = [17, 24, 39]
const MUTED: [number, number, number] = [100, 110, 126]
const LINE: [number, number, number] = [226, 232, 240]
const WASH: [number, number, number] = [244, 247, 255]
const WHITE: [number, number, number] = [255, 255, 255]

const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 18
const CONTENT_W = PAGE_W - MARGIN * 2
const FIRST_TOP = 48
const NEXT_TOP = 24
const BOTTOM = PAGE_H - 18

async function asDataUrl(src: string) {
  if (src.startsWith("data:")) return src
  const response = await fetch(src)
  if (!response.ok) return ""
  const blob = await response.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function fitLogo(width: number, height: number, maxW: number, maxH: number) {
  const ratio = width / height || 1
  let h = maxH
  let w = h * ratio
  if (w > maxW) {
    w = maxW
    h = w / ratio
  }
  return { w, h }
}

async function loadLogo() {
  const data = await asDataUrl("/logo.png").catch(() => "")
  if (!data) return { data: "", w: 0, h: 0 }
  if (typeof Image === "undefined") return { data, w: 1, h: 1 }
  const size = await new Promise<{ w: number; h: number }>((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve({ w: 1, h: 1 })
    img.src = data
  })
  return { data, ...size }
}

function stripInline(text: string) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+\.\s+/, "")
}

class BriefPdf {
  doc = new jsPDF({ unit: "mm", format: "a4" })
  y = FIRST_TOP
  page = 1

  constructor(private logo: { data: string; w: number; h: number }) {}

  drawLogo(x: number, y: number, maxW: number, maxH: number) {
    if (!this.logo.data) return 0
    const box = fitLogo(this.logo.w, this.logo.h, maxW, maxH)
    try {
      this.doc.addImage(this.logo.data, "PNG", x, y + (maxH - box.h) / 2, box.w, box.h)
      return box.w
    } catch {
      return 0
    }
  }

  paintCover(agentName: string, when: string, domain?: string) {
    const { doc } = this
    doc.setFillColor(...NAVY)
    doc.rect(0, 0, PAGE_W, 38, "F")
    doc.setFillColor(...BLUE)
    doc.rect(0, 38, PAGE_W, 1.8, "F")
    const logoW = this.drawLogo(MARGIN, 10, 22, 16)
    const textX = logoW ? MARGIN + logoW + 4 : MARGIN
    doc.setTextColor(...WHITE)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(18)
    doc.text("Taskora", textX, 17)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(186, 206, 255)
    doc.text("by LCX", textX, 23)
    doc.setTextColor(...WHITE)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    doc.text("RESEARCH BRIEF", PAGE_W - MARGIN, 15, { align: "right" })
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(186, 206, 255)
    doc.text(when, PAGE_W - MARGIN, 21, { align: "right" })
    if (domain) {
      doc.setFontSize(7)
      doc.text(domain.toUpperCase(), PAGE_W - MARGIN, 27, { align: "right" })
    }
    this.y = FIRST_TOP
    doc.setTextColor(...INK)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(20)
    const title = doc.splitTextToSize(agentName, CONTENT_W)
    doc.text(title, MARGIN, this.y)
    this.y += title.length * 8 + 4
    doc.setDrawColor(...BLUE)
    doc.setLineWidth(0.6)
    doc.line(MARGIN, this.y, MARGIN + 22, this.y)
    this.y += 8
  }

  paintRunningHeader() {
    const { doc } = this
    doc.setFillColor(...NAVY)
    doc.rect(0, 0, PAGE_W, 14, "F")
    doc.setFillColor(...BLUE)
    doc.rect(0, 14, PAGE_W, 0.8, "F")
    const logoW = this.drawLogo(MARGIN, 2.2, 14, 9)
    doc.setTextColor(...WHITE)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.text("Taskora", logoW ? MARGIN + logoW + 3 : MARGIN, 8.6)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(186, 206, 255)
    doc.text("by LCX", PAGE_W - MARGIN, 8.6, { align: "right" })
    this.y = NEXT_TOP
  }

  addPage() {
    this.doc.addPage()
    this.page += 1
    this.paintRunningHeader()
  }

  ensure(height: number) {
    if (this.y + height <= BOTTOM) return
    this.addPage()
  }

  section(label: string) {
    this.ensure(16)
    this.doc.setFont("helvetica", "bold")
    this.doc.setFontSize(8)
    this.doc.setTextColor(...BLUE)
    this.doc.text(label.toUpperCase(), MARGIN, this.y)
    this.y += 2.2
    this.doc.setDrawColor(...BLUE)
    this.doc.setLineWidth(0.35)
    this.doc.line(MARGIN, this.y, MARGIN + 16, this.y)
    this.y += 6
    this.doc.setTextColor(...INK)
  }

  paragraph(text: string, opts?: { muted?: boolean; size?: number; bold?: boolean; boxed?: boolean }) {
    const size = opts?.size ?? 10.5
    const pad = opts?.boxed ? 4 : 0
    const width = CONTENT_W - pad * 2
    this.doc.setFont("helvetica", opts?.bold ? "bold" : "normal")
    this.doc.setFontSize(size)
    const lines = this.doc.splitTextToSize(text || "—", width) as string[]
    const lineH = size * 0.42
    const block = lines.length * lineH + pad * 2
    this.ensure(block + 3)
    if (opts?.boxed) {
      this.doc.setFillColor(...WASH)
      this.doc.roundedRect(MARGIN, this.y - 3.2, CONTENT_W, block + 1, 1.6, 1.6, "F")
    }
    this.doc.setTextColor(...(opts?.muted ? MUTED : INK))
    if (opts?.boxed) this.y += pad - 1
    for (const line of lines) {
      this.ensure(lineH + 1)
      this.doc.text(line, MARGIN + pad, this.y)
      this.y += lineH
    }
    this.y += opts?.boxed ? pad + 3 : 3
  }

  markdown(text: string) {
    const lines = text.replace(/\r\n/g, "\n").split("\n")
    let i = 0
    while (i < lines.length) {
      const raw = lines[i] ?? ""
      const trimmed = raw.trim()
      if (!trimmed) {
        this.y += 2
        i += 1
        continue
      }
      if (trimmed.startsWith("|")) {
        const rows: string[][] = []
        while (i < lines.length && lines[i]?.trim().startsWith("|")) {
          const cells = (lines[i] ?? "")
            .split("|")
            .slice(1, -1)
            .map((cell) => stripInline(cell.trim()))
          if (!/^:?-{3,}:?$/.test(cells[0] ?? "")) rows.push(cells)
          i += 1
        }
        this.table(rows)
        continue
      }
      if (/^#{1,3}\s/.test(trimmed)) {
        const level = (trimmed.match(/^#+/) ?? ["#"])[0].length
        this.ensure(10)
        this.doc.setFont("helvetica", "bold")
        this.doc.setFontSize(level === 1 ? 14 : level === 2 ? 12 : 11)
        this.doc.setTextColor(...INK)
        const heading = this.doc.splitTextToSize(stripInline(trimmed), CONTENT_W) as string[]
        for (const line of heading) {
          this.ensure(6)
          this.doc.text(line, MARGIN, this.y)
          this.y += 6
        }
        this.y += 2
        i += 1
        continue
      }
      if (/^[-*+]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
        this.bullet(stripInline(trimmed))
        i += 1
        continue
      }
      if (/^---+$/.test(trimmed)) {
        this.ensure(6)
        this.doc.setDrawColor(...LINE)
        this.doc.setLineWidth(0.2)
        this.doc.line(MARGIN, this.y, PAGE_W - MARGIN, this.y)
        this.y += 5
        i += 1
        continue
      }
      this.paragraph(stripInline(trimmed))
      i += 1
    }
  }

  bullet(text: string) {
    this.doc.setFont("helvetica", "normal")
    this.doc.setFontSize(10.5)
    this.doc.setTextColor(...INK)
    const lines = this.doc.splitTextToSize(text, CONTENT_W - 6) as string[]
    for (const [index, line] of lines.entries()) {
      this.ensure(5)
      if (index === 0) {
        this.doc.setFillColor(...BLUE)
        this.doc.circle(MARGIN + 1.2, this.y - 1.1, 0.7, "F")
      }
      this.doc.text(line, MARGIN + 5, this.y)
      this.y += 4.6
    }
    this.y += 1.2
  }

  table(rows: string[][]) {
    if (rows.length === 0) return
    const cols = Math.max(...rows.map((row) => row.length), 1)
    const colW = CONTENT_W / cols
    const rowH = 6.4
    for (const [index, row] of rows.entries()) {
      this.ensure(rowH)
      if (index === 0) {
        this.doc.setFillColor(...NAVY)
        this.doc.rect(MARGIN, this.y - 4.2, CONTENT_W, rowH, "F")
        this.doc.setTextColor(...WHITE)
        this.doc.setFont("helvetica", "bold")
      } else {
        if (index % 2 === 0) {
          this.doc.setFillColor(...WASH)
          this.doc.rect(MARGIN, this.y - 4.2, CONTENT_W, rowH, "F")
        }
        this.doc.setTextColor(...INK)
        this.doc.setFont("helvetica", "normal")
      }
      this.doc.setFontSize(8)
      row.forEach((cell, col) => {
        const clipped = this.doc.splitTextToSize(cell, colW - 3)[0] ?? ""
        this.doc.text(clipped, MARGIN + col * colW + 1.6, this.y)
      })
      this.y += rowH
    }
    this.y += 4
  }

  image(dataUrl: string, caption?: string) {
    if (!dataUrl) return
    const height = 62
    this.ensure(height + 10)
    this.doc.setFillColor(...WASH)
    this.doc.roundedRect(MARGIN, this.y - 2, CONTENT_W, height + 6, 2, 2, "F")
    try {
      this.doc.addImage(dataUrl, "PNG", MARGIN + 3, this.y, CONTENT_W - 6, height)
    } catch {
      this.paragraph("Chart image could not be embedded.", { muted: true, size: 9 })
      return
    }
    this.y += height + 6
    if (caption) {
      this.doc.setFont("helvetica", "normal")
      this.doc.setFontSize(8)
      this.doc.setTextColor(...MUTED)
      this.doc.text(caption, MARGIN, this.y)
      this.y += 6
    } else {
      this.y += 3
    }
  }

  stamp() {
    const total = this.doc.getNumberOfPages()
    for (let i = 1; i <= total; i += 1) {
      this.doc.setPage(i)
      this.doc.setDrawColor(...LINE)
      this.doc.setLineWidth(0.2)
      this.doc.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12)
      this.doc.setFont("helvetica", "normal")
      this.doc.setFontSize(7.5)
      this.doc.setTextColor(...MUTED)
      this.doc.text("Taskora by LCX  ·  Research output", MARGIN, PAGE_H - 7)
      this.doc.text(`${i} / ${total}`, PAGE_W - MARGIN, PAGE_H - 7, { align: "right" })
    }
  }
}

export async function buildExportPdf(input: ExportMemoInput & { domain?: string }) {
  const logo = await loadLogo()
  const pdf = new BriefPdf(logo)
  const name = input.agentName.trim() || "Research desk"
  pdf.paintCover(name, formatExportWhen(input.at), input.domain)
  pdf.section("Description")
  pdf.paragraph(input.brief.trim() || "—", { boxed: true })
  if (input.instructions?.trim()) {
    pdf.section("Instructions")
    pdf.paragraph(input.instructions.trim(), { boxed: true })
  }
  if (input.chartImage || (input.series?.length ?? 0) > 0) {
    pdf.section("Chart")
    if (input.chartImage) {
      const symbols = (input.series ?? []).map((row) => row.symbol).join(" · ")
      pdf.image(input.chartImage, symbols || undefined)
    }
    if (input.series?.length) {
      const months = [
        ...new Set(input.series.flatMap((row) => row.data.map((point) => point.month))),
      ].sort()
      const header = ["Month", ...input.series.map((row) => row.symbol)]
      const rows = months.map((month) => [
        month,
        ...input.series!.map((row) => {
          const point = row.data.find((item) => item.month === month)
          return point ? point.price.toFixed(2) : "—"
        }),
      ])
      pdf.table([header, ...rows])
    }
  }
  if (input.memo.trim()) {
    pdf.section("Output")
    pdf.markdown(input.memo.trim())
  }
  const sources = (input.citations ?? []).filter((row) => row.url)
  if (sources.length > 0) {
    pdf.section("Sources")
    for (const row of sources) {
      pdf.bullet(row.quote ? `${row.url} — ${row.quote}` : String(row.url))
    }
  }
  pdf.stamp()
  return { doc: pdf.doc, name }
}

export async function downloadExportPdf(input: ExportMemoInput & { domain?: string }) {
  const { doc, name } = await buildExportPdf(input)
  doc.save(`${exportFileStem(name, input.at)}.pdf`)
}
