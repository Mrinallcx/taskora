import { NextResponse } from "next/server"

import { connect } from "@/src/db/connect"
import { jsonError } from "@/src/lib/http"
import { getSessionUser } from "@/src/lib/auth"
import { ApiError } from "@/src/domain/errors"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV === "production") {
      throw new ApiError("forbidden", "Not available in production", 403)
    }
    const user = await getSessionUser(request)
    const body = await request.json().catch(() => ({ cents: 100000 }))
    const cents = Number(body.cents ?? 100000)
    await connect()
    user.availableCents += cents
    await user.save()
    return NextResponse.json({
      availableCents: user.availableCents,
      escrowedCents: user.escrowedCents,
    })
  } catch (error) {
    return jsonError(error)
  }
}
