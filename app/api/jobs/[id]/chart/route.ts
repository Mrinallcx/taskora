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

function chartBody(
  asset: { id: string; label: string; symbol: string },
  points: [number, number][],
  source: string,
  provider: string
) {
  const data = monthlyPrices(points)
  return {
    chart: {
      id: asset.id,
      label: asset.label,
      symbol: asset.symbol,
      source,
      provider,
      window: chartWindowLabel(data),
      range: monthRangeLabel(data),
      data,
    },
  }
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
    const asset = resolveFinanceAsset(job.brief)
    if (!asset) {
      return NextResponse.json({
        chart: null,
        error: "No ticker found in this brief.",
      })
    }
    const cacheKey = `v3:${job._id}:${asset.kind}:${asset.id}`
    const hit = cached(cacheKey)
    if (hit) return NextResponse.json(hit)
    if (asset.kind === "crypto") {
      const result = await coinGeckoFiveYearChart(asset.id)
      if (!result.ok) {
        return NextResponse.json({ chart: null, error: result.message })
      }
      const body = chartBody(
        asset,
        result.data.points,
        result.data.sourceUrl,
        result.data.provider
      )
      cache.set(cacheKey, { at: Date.now(), body })
      return NextResponse.json(body)
    }
    const key = process.env.PRICES_API_KEY
    if (!key) {
      return NextResponse.json({
        chart: null,
        error: "PRICES_API_KEY missing for stock history.",
      })
    }
    const stock = await alphaVantageMonthly(asset.symbol, key)
    if (!stock.ok) {
      return NextResponse.json({ chart: null, error: stock.message })
    }
    const body = chartBody(asset, stock.data.points, stock.data.sourceUrl, "Alpha Vantage")
    cache.set(cacheKey, { at: Date.now(), body })
    return NextResponse.json(body)
  } catch (error) {
    return jsonError(error)
  }
}
