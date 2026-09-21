import { NextResponse } from "next/server"
import { z } from "zod"

import { reviewsForListing, upsertListingReview } from "@/src/domain/listing-reviews"
import { ApiError } from "@/src/domain/errors"
import { jsonError } from "@/src/lib/http"
import { getSessionUser } from "@/src/lib/auth"
import { hex } from "@/src/lib/ids"
import { rateLimit } from "@/src/domain/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const saveSchema = z.object({
  stars: z.number().int().min(1).max(5),
  body: z.string().max(800).default(""),
})

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser(request)
    const { id } = await context.params
    const summary = await reviewsForListing(id, hex(user._id))
    return NextResponse.json(summary)
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser(request)
    if (!rateLimit(`review:${user.clerkUserId}`, 40, 60 * 60 * 1000)) {
      throw new ApiError("rate_limited", "Too many reviews", 429)
    }
    const { id } = await context.params
    let json: unknown
    try {
      json = await request.json()
    } catch {
      throw new ApiError("invalid", "Invalid JSON")
    }
    const parsed = saveSchema.safeParse(json)
    if (!parsed.success) {
      throw new ApiError("invalid", "Pick a rating from 1 to 5")
    }
    const summary = await upsertListingReview(id, hex(user._id), parsed.data)
    return NextResponse.json(summary)
  } catch (error) {
    return jsonError(error)
  }
}
