"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useRef } from "react"
import { useTheme } from "next-themes"
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  FileChartColumn,
} from "lucide-react"
import type { EChartsOption, EChartsType } from "echarts"

import { cn } from "cn"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false })

export type PriceSeries = {
  label: string
  symbol: string
  data: { month: string; price: number }[]
}

const PALETTE = [
  { line: "#0d9488", area: "rgba(13, 148, 136, 0.2)" },
  { line: "#2563eb", area: "rgba(37, 99, 235, 0.18)" },
  { line: "#7c3aed", area: "rgba(124, 58, 237, 0.18)" },
  { line: "#db2777", area: "rgba(219, 39, 119, 0.16)" },
  { line: "#d97706", area: "rgba(217, 119, 6, 0.16)" },
  { line: "#059669", area: "rgba(5, 150, 105, 0.16)" },
]

const PALETTE_DARK = [
  { line: "#2dd4bf", area: "rgba(45, 212, 191, 0.22)" },
  { line: "#60a5fa", area: "rgba(96, 165, 250, 0.2)" },
  { line: "#a78bfa", area: "rgba(167, 139, 250, 0.2)" },
  { line: "#f472b6", area: "rgba(244, 114, 182, 0.18)" },
  { line: "#fbbf24", area: "rgba(251, 191, 36, 0.18)" },
  { line: "#34d399", area: "rgba(52, 211, 153, 0.18)" },
]

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value)
}

function monthToTime(month: string) {
  const [year, rest] = month.split("-")
  return Date.UTC(Number(year), Number(rest) - 1, 1)
}

function seriesStats(data: PriceSeries["data"]) {
  const first = data[0]?.price ?? 0
  const last = data.at(-1)?.price ?? 0
  const change = last - first
  const percent = first > 0 ? (change / first) * 100 : 0
  return { first, last, change, percent, up: change >= 0 }
}

function clockLabel() {
  return new Date().toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

export function PriceHistoryChart({
  title,
  interval,
  provider,
  kind,
  series,
  onChartImage,
}: {
  title: string
  interval?: string
  provider?: string
  kind?: "stock" | "crypto"
  series: PriceSeries[]
  onChartImage?: (dataUrl: string) => void
}) {
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme === "dark"
  const colors = dark ? PALETTE_DARK : PALETTE
  const chartRef = useRef<EChartsType | null>(null)
  const lastImage = useRef("")
  const emitChartImage = (chart: EChartsType | null) => {
    if (!chart) return
    try {
      const url = chart.getDataURL({
        type: "png",
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      })
      if (url && url !== lastImage.current) {
        lastImage.current = url
        onChartImage?.(url)
      }
    } catch {
      /* export still works without the image */
    }
  }

  const rows = useMemo(
    () =>
      series
        .filter((row) => row.data.length > 1)
        .map((row, index) => ({
          ...row,
          ...seriesStats(row.data),
          color: colors[index % colors.length],
        })),
    [series, colors]
  )

  const total = useMemo(() => {
    const first = rows.reduce((sum, row) => sum + row.first, 0)
    const last = rows.reduce((sum, row) => sum + row.last, 0)
    const change = last - first
    return {
      percent: first > 0 ? (change / first) * 100 : 0,
      up: change >= 0,
    }
  }, [rows])

  const option = useMemo<EChartsOption>(() => {
    const muted = dark ? "#a1a1aa" : "#71717a"
    const grid = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"
    const cross = dark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)"
    return {
      backgroundColor: "transparent",
      legend: {
        data: rows.map((row) => row.symbol),
        bottom: 0,
        itemWidth: 10,
        itemHeight: 6,
        textStyle: { color: muted, fontSize: 10 },
      },
      grid: { top: 8, right: 52, bottom: rows.length > 1 ? 36 : 22, left: 4 },
      tooltip: {
        trigger: "axis",
        backgroundColor: dark ? "rgba(9,9,11,0.95)" : "rgba(255,255,255,0.98)",
        borderColor: dark ? "rgba(63,63,70,0.4)" : "rgba(228,228,231,0.8)",
        borderWidth: 1,
        textStyle: { color: dark ? "#fafafa" : "#18181b", fontSize: 12 },
        axisPointer: {
          type: "line",
          lineStyle: { color: cross, width: 1, type: "dashed" },
        },
        formatter: (params) => {
          const items = Array.isArray(params) ? params : [params]
          const first = items[0] as { value?: [number, number] }
          const when = first?.value?.[0]
            ? new Date(first.value[0]).toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
              })
            : ""
          const lines = items
            .map((item) => {
              const row = item as {
                seriesName?: string
                value?: [number, number]
                color?: string
              }
              if (!row.value) return ""
              return `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:4px"><span style="color:${row.color}">${row.seriesName}</span><span>${money(row.value[1])}</span></div>`
            })
            .join("")
          return `<div style="min-width:160px"><div style="color:${muted};margin-bottom:4px">${when}</div>${lines}</div>`
        },
      },
      xAxis: {
        type: "time",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          color: muted,
          fontSize: 10,
          formatter: (value: number) =>
            new Date(value).toLocaleDateString("en-US", {
              month: "short",
              year: "2-digit",
            }),
        },
      },
      yAxis: {
        type: "value",
        position: "right",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: muted,
          fontSize: 10,
          formatter: (value: number) => money(value),
        },
        splitLine: { lineStyle: { color: grid, type: "dashed" } },
      },
      series: rows.map((row) => ({
        name: row.symbol,
        type: "line",
        smooth: 0.4,
        showSymbol: false,
        data: row.data.map((point) => [monthToTime(point.month), point.price]),
        itemStyle: { color: row.color.line },
        lineStyle: { color: row.color.line, width: 2 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              {
                offset: 0,
                color: rows.length > 1 ? row.color.area.replace(/[\d.]+\)$/, "0.08)") : row.color.area,
              },
              { offset: 1, color: "rgba(0,0,0,0)" },
            ],
          },
        },
      })),
    }
  }, [dark, rows])

  useEffect(() => {
    const timer = window.setTimeout(() => emitChartImage(chartRef.current), 250)
    return () => window.clearTimeout(timer)
  }, [option])

  if (rows.length === 0) return null

  const headline =
    rows.length === 1
      ? `${rows[0].label} (${rows[0].symbol}) Stock - Latest`
      : `${rows.map((row) => row.symbol).join(" vs ")} - Latest`

  return (
    <Collapsible
      defaultOpen
      className="overflow-hidden rounded-xl border border-border"
    >
      <CollapsibleTrigger className="focus-visible:border-ring focus-visible:ring-ring/50 flex w-full items-center gap-3 px-4 py-[14px] text-left outline-none focus-visible:ring-[3px] [&[data-panel-open]_[data-slot=chart-chevron]]:rotate-180">
        <div className="bg-primary/10 flex size-[34px] shrink-0 items-center justify-center rounded-[9px]">
          <FileChartColumn className="text-primary size-4" />
        </div>
        <div className="flex min-w-0 grow flex-col gap-[2px]">
          <span className="text-muted-foreground font-mono text-[10px] leading-3 tracking-[0.1em] uppercase">
            {kind === "crypto" || provider === "CoinGecko"
              ? "Crypto analysis"
              : "Stock analysis"}
          </span>
          <span className="text-foreground truncate text-[15px] leading-5 font-medium">
            {headline}
          </span>
        </div>
        <span className="text-muted-foreground hidden shrink-0 font-mono text-[11px] leading-[14px] tabular-nums sm:inline">
          {clockLabel()}
        </span>
        <Badge
          variant="outline"
          className={cn(
            "h-6 shrink-0 gap-1 px-[9px] py-0 text-[11px] leading-[14px] tabular-nums [&>svg]:size-[11px]",
            total.up
              ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
              : "border-destructive/40 text-destructive"
          )}
        >
          {total.up ? (
            <ArrowUpRight />
          ) : (
            <ArrowDownRight />
          )}
          {total.up ? "+" : ""}
          {total.percent.toFixed(2)}%
        </Badge>
        <ChevronDown
          data-slot="chart-chevron"
          className="text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5 transition-transform duration-200"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden">
        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] leading-[14px]">
            <span className="font-mono">{interval ?? "1 year"}</span>
            <span>/</span>
            <span className="tabular-nums">
              {rows.length} {rows.length === 1 ? "series" : "series"}
            </span>
            {provider ? (
              <>
                <span>/</span>
                <span>{provider}</span>
              </>
            ) : null}
          </div>
          <div className="border-border bg-muted/25 rounded-sm border p-3">
            <ReactECharts
              option={option}
              style={{ height: rows.length > 1 ? 240 : 200, width: "100%" }}
              onChartReady={(chart) => {
                chartRef.current = chart
                emitChartImage(chart)
              }}
            />
          </div>
          <div
            className={cn(
              "border-border overflow-hidden rounded-sm border",
              rows.length > 1 && "sm:grid sm:grid-cols-2 sm:border-0 sm:gap-2"
            )}
          >
            {rows.map((row, index) => (
              <div
                key={row.symbol}
                className={cn(
                  "flex items-center justify-between px-3 py-2.5",
                  rows.length > 1
                    ? "border-border rounded-sm border"
                    : index > 0 && "border-border border-t"
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: row.color.line }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.label}</p>
                    <p className="text-muted-foreground font-mono text-[11px]">
                      {row.symbol}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium tabular-nums">{money(row.last)}</p>
                  <p
                    className={cn(
                      "inline-flex items-center justify-end gap-0.5 text-[11px] tabular-nums",
                      row.up
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-destructive"
                    )}
                  >
                    {row.up ? (
                      <ArrowUpRight className="size-3" />
                    ) : (
                      <ArrowDownRight className="size-3" />
                    )}
                    {row.up ? "+" : ""}
                    {row.percent.toFixed(2)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
