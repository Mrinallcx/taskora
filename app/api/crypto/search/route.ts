import { NextResponse } from "next/server"

import { searchCrypto } from "@/src/domain/crypto-listings"
import { ApiError } from "@/src/domain/errors"
import { rateLimit } from "@/src/domain/rate-limit"
import { jsonError } from "@/src/lib/http"
import { getSessionUser } from "@/src/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request)
    if (!rateLimit(`crypto:${user.clerkUserId}`, 40, 60 * 1000)) {
      throw new ApiError("rate_limited", "Too many crypto searches", 429)
    }
    const query = new URL(request.url).searchParams.get("q") ?? ""
    if (query.trim().length < 2) {
      return NextResponse.json({ results: [] })
    }
    const results = await searchCrypto(query)
    return NextResponse.json({ results })
  } catch (error) {
    return jsonError(error)
  }
}
