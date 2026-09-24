"use client"

import { useState } from "react"
import { Check, Copy, FileDown } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { downloadExportPdf } from "@/components/export-pdf"
import {
  buildExportMarkdown,
  type ExportMemoInput,
} from "@/src/domain/export-output"

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const area = document.createElement("textarea")
  area.value = text
  area.setAttribute("readonly", "")
  area.style.position = "fixed"
  area.style.left = "-9999px"
  document.body.appendChild(area)
  area.select()
  document.execCommand("copy")
  area.remove()
}

export function OutputExport({
  agentName,
  at,
  brief,
  instructions,
  memo,
  citations,
  series,
  chartImage,
  domain,
}: ExportMemoInput & { domain?: string }) {
  const [busy, setBusy] = useState<"pdf" | "md" | "">("")
  const [copied, setCopied] = useState(false)
  const ready = Boolean(brief.trim() || memo.trim() || series?.length || chartImage)

  async function onPdf() {
    setBusy("pdf")
    try {
      await downloadExportPdf({
        agentName,
        at,
        brief,
        instructions,
        memo,
        citations,
        series,
        chartImage,
        domain,
      })
      toast.success("PDF downloaded")
    } catch {
      toast.error("Could not build the PDF")
    } finally {
      setBusy("")
    }
  }

  async function onMarkdown() {
    setBusy("md")
    const full = buildExportMarkdown({
      agentName,
      at,
      brief,
      instructions,
      memo,
      citations,
      series,
      chartImage,
    })
    const compact = buildExportMarkdown({
      agentName,
      at,
      brief,
      instructions,
      memo,
      citations,
      series,
    })
    try {
      try {
        await copyText(full)
      } catch {
        await copyText(compact)
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
      toast.success("Markdown copied")
    } catch {
      toast.error("Could not copy markdown")
    } finally {
      setBusy("")
    }
  }

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!ready || busy === "pdf"}
        onClick={() => void onPdf()}
      >
        <FileDown data-icon="inline-start" />
        {busy === "pdf" ? "PDF…" : "PDF"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!ready || busy === "md"}
        onClick={() => void onMarkdown()}
      >
        {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
        {copied ? "Copied" : "Markdown"}
      </Button>
    </div>
  )
}
