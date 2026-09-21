import { NextResponse } from "next/server"
import { z } from "zod"

import { connect } from "@/src/db/connect"
import { Merchant } from "@/src/db/models"
import { ApiError } from "@/src/domain/errors"
import { jsonError } from "@/src/lib/http"
import { getSessionUser } from "@/src/lib/auth"
import { hex } from "@/src/lib/ids"
import { rateLimit } from "@/src/domain/rate-limit"
import {
  parseLogo,
  parseWebsite,
  serializeMerchant,
  slugifyBrand,
} from "@/src/domain/merchants"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const saveSchema = z.object({
  name: z.string().trim().min(1).max(80),
  tagline: z.string().trim().max(160).default(""),
  about: z.string().trim().max(2000).default(""),
  website: z.string().trim().max(300).default(""),
  logo: z.string().max(350_000).default(""),
  status: z.enum(["draft", "live"]).default("draft"),
  isPublic: z.boolean().default(false),
})

async function uniqueSlug(base: string, ownerUserId: string) {
  let slug = base
  for (let i = 0; i < 8; i += 1) {
    const clash = await Merchant.findOne({ slug, ownerUserId: { $ne: ownerUserId } })
    if (!clash) return slug
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`
  }
  throw new ApiError("conflict", "Could not create a brand URL", 409)
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request)
    await connect()
    const merchant = await Merchant.findOne({ ownerUserId: hex(user._id) })
    return NextResponse.json({
      merchant: merchant ? serializeMerchant(merchant) : null,
    })
  } catch (error) {
    return jsonError(error)
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getSessionUser(request)
    if (!rateLimit(`merchant:${user.clerkUserId}`, 30, 60 * 60 * 1000)) {
      throw new ApiError("rate_limited", "Too many brand saves", 429)
    }
    let json: unknown
    try {
      json = await request.json()
    } catch {
      throw new ApiError("invalid", "Invalid JSON")
    }
    const parsed = saveSchema.safeParse(json)
    if (!parsed.success) {
      throw new ApiError("invalid", "Check the brand fields and try again.")
    }
    const data = parsed.data
    const ownerUserId = hex(user._id)
    const website = parseWebsite(data.website)
    const logo = parseLogo(data.logo)
    const status = data.status
    const isPublic = status === "live" ? data.isPublic : false
    await connect()
    const existing = await Merchant.findOne({ ownerUserId })
    const slug =
      existing?.status === "live"
        ? existing.slug
        : await uniqueSlug(slugifyBrand(data.name), ownerUserId)
    const merchant = await Merchant.findOneAndUpdate(
      { ownerUserId },
      {
        ownerUserId,
        slug,
        name: data.name,
        tagline: data.tagline,
        about: data.about,
        website,
        logo,
        status,
        isPublic,
      },
      { upsert: true, returnDocument: "after" }
    )
    if (!merchant) throw new ApiError("invalid", "Could not save brand", 500)
    return NextResponse.json({ merchant: serializeMerchant(merchant) })
  } catch (error) {
    return jsonError(error)
  }
}
