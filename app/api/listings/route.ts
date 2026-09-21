import { NextResponse } from "next/server"

import { Listing } from "@/src/db/models"
import { connect } from "@/src/db/connect"
import { jsonError } from "@/src/lib/http"
import { getSessionUser } from "@/src/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    await getSessionUser(request)
    await connect()
    const listings = await Listing.find({ status: "live" }).sort({ slug: 1 })
    return NextResponse.json({
      listings: listings.map((row) => ({
        id: String(row._id),
        slug: row.slug,
        kind: row.kind,
        ownerUserId: row.ownerUserId,
        vertical: row.vertical,
        priceCents: row.priceCents,
        name: row.name || row.slug,
        summary: row.summary,
        skills: row.skills,
        isPublic: row.isPublic,
        tools: row.tools,
      })),
    })
  } catch (error) {
    return jsonError(error)
  }
}
