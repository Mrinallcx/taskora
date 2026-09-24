import { NextResponse } from "next/server"

import { ApiError } from "@/src/domain/errors"
import { rateLimit } from "@/src/domain/rate-limit"
import { searchNasdaqStocks } from "@/src/domain/stock-listings"
import { jsonError } from "@/src/lib/http"
import { getSessionUser } from "@/src/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request)
    if (!rateLimit(`stocks:${user.clerkUserId}`, 40, 60 * 1000)) {
      throw new ApiError("rate_limited", "Too many stock searches", 429)
    }
    const query = new URL(request.url).searchParams.get("q") ?? ""
    if (query.trim().length < 2) {
      return NextResponse.json({ results: [] })
    }
    const results = await searchNasdaqStocks(query)
    return NextResponse.json({ results })
  } catch (error) {
    return jsonError(error)
  }
}
