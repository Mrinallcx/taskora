import { NextResponse } from "next/server"

import { connect } from "@/src/db/connect"
import { Job } from "@/src/db/models"
import { ApiError } from "@/src/domain/errors"
import {
  chartWindowLabel,
  monthRangeLabel,
  monthlyPrices,
} from "@/src/domain/finance-asset"
import { tickersForJob } from "@/src/domain/job-chart"
import { jsonError } from "@/src/lib/http"
import { getSessionUser } from "@/src/lib/auth"
import { asObjectId } from "@/src/lib/ids"
import {
  coinGeckoFiveYearChart,
  resolveCoinGeckoId,
} from "@/src/tools/crypto/coingecko"
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
    const cacheKey = `v6:${job._id}:${tickers.map((row) => `${row.kind}:${row.symbol}`).join(",")}`
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
        const geckoId = await resolveCoinGeckoId(ticker.symbol)
        const result = await coinGeckoFiveYearChart(geckoId)
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
      const crypto = tickers.some((row) => row.kind === "crypto")
      return NextResponse.json({
        chart: null,
        error: crypto
          ? "No CoinGecko price history for these coins."
          : key
            ? "No price history for these tickers."
            : "ALPHAVANTAGE_API_KEY missing for stock history.",
      })
    }

    const first = series[0].data
    const body = {
      chart: {
        label: series.map((row) => row.symbol).join(" · "),
        symbol: series[0].symbol,
        kind: tickers[0].kind,
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
