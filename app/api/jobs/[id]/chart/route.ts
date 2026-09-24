import { NextResponse } from "next/server"

import { connect } from "@/src/db/connect"
import { Job } from "@/src/db/models"
import { ApiError } from "@/src/domain/errors"
import {
  chartWindowLabel,
  monthRangeLabel,
  monthlyPrices,
  resolveFinanceAsset,
} from "@/src/domain/finance-asset"
import { jsonError } from "@/src/lib/http"
import { getSessionUser } from "@/src/lib/auth"
import { asObjectId } from "@/src/lib/ids"
import { MAX_LAUNCH_STOCKS } from "@/src/domain/stock-types"
import { coinGeckoFiveYearChart } from "@/src/tools/crypto/coingecko"
import { alphaVantageMonthly } from "@/src/tools/prices/alphavantage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const cache = new Map<string, { at: number; body: unknown }>()
const TTL_MS = 6 * 60 * 60 * 1000

function cached(key: string) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.body
  return null
}

function tickersForJob(job: {
  brief: string
  instructions?: string
  symbol?: string
  companyName?: string
  symbols?: { symbol?: string; name?: string }[]
}) {
  if (Array.isArray(job.symbols) && job.symbols.some((row) => row.symbol?.trim())) {
    return job.symbols
      .filter((row) => row.symbol?.trim())
      .slice(0, MAX_LAUNCH_STOCKS)
      .map((row) => ({
        symbol: String(row.symbol).trim().toUpperCase(),
        name: String(row.name ?? row.symbol).trim(),
        kind: "stock" as const,
      }))
  }
  if (job.symbol?.trim()) {
    return [
      {
        symbol: job.symbol.trim().toUpperCase(),
        name: job.companyName?.trim() || job.symbol.trim(),
        kind: "stock" as const,
      },
    ]
  }
  const asset = resolveFinanceAsset(`${job.brief}\n${job.instructions ?? ""}`)
  if (!asset) return []
  return [
    {
      symbol: asset.symbol,
      name: asset.label,
      kind: asset.kind,
    },
  ]
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser(request)
    const { id } = await context.params
    const objectId = asObjectId(id)
    if (!objectId) throw new ApiError("not_found", "Job not found", 404)
    await connect()
    const job = await Job.findOne({ _id: objectId, userId: user._id })
    if (!job) throw new ApiError("not_found", "Job not found", 404)
    if (job.domain !== "finance") {
      return NextResponse.json({ chart: null })
    }
    const tickers = tickersForJob(job)
    if (tickers.length === 0) {
      return NextResponse.json({
        chart: null,
        error: "No ticker found in this brief.",
      })
    }
    const cacheKey = `v5:${job._id}:${tickers.map((row) => row.symbol).join(",")}`
    const hit = cached(cacheKey)
    if (hit) return NextResponse.json(hit)

    const key =
      process.env.ALPHAVANTAGE_API_KEY?.trim() ||
      process.env.PRICES_API_KEY?.trim()
    const series: {
      label: string
      symbol: string
      data: { month: string; price: number }[]
    }[] = []

    for (const ticker of tickers) {
      if (ticker.kind === "crypto") {
        const result = await coinGeckoFiveYearChart(ticker.symbol.toLowerCase())
        if (!result.ok) continue
        series.push({
          label: ticker.name,
          symbol: ticker.symbol,
          data: monthlyPrices(result.data.points),
        })
        continue
      }
      if (!key) continue
      const stock = await alphaVantageMonthly(ticker.symbol, key)
      if (!stock.ok) continue
      series.push({
        label: ticker.name,
        symbol: ticker.symbol,
        data: monthlyPrices(stock.data.points),
      })
    }

    if (series.length === 0) {
      return NextResponse.json({
        chart: null,
        error: key
          ? "No price history for these tickers."
          : "ALPHAVANTAGE_API_KEY missing for stock history.",
      })
    }

    const first = series[0].data
    const body = {
      chart: {
        label: series.map((row) => row.symbol).join(" · "),
        symbol: series[0].symbol,
        provider: tickers[0].kind === "crypto" ? "CoinGecko" : "Alpha Vantage",
        window: chartWindowLabel(first),
        range: monthRangeLabel(first),
        data: first,
        series,
      },
    }
    if (series.length === tickers.length) {
      cache.set(cacheKey, { at: Date.now(), body })
    }
    return NextResponse.json(body)
  } catch (error) {
    return jsonError(error)
  }
}
