import { NextResponse } from "next/server"

import { connect } from "@/src/db/connect"
import { Credential } from "@/src/db/models"
import { encryptSecret } from "@/src/crypto/secrets"
import { jsonError } from "@/src/lib/http"
import { getSessionUser } from "@/src/lib/auth"
import { ApiError } from "@/src/domain/errors"
import { rateLimit } from "@/src/domain/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request)
    await connect()
    const rows = await Credential.find({ userId: user._id })
    return NextResponse.json({
      credentials: rows.map((row) => ({
        kind: row.kind,
        configured: true,
        last4: row.last4,
      })),
    })
  } catch (error) {
    return jsonError(error)
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getSessionUser(request)
    if (!rateLimit(`cred:${user.clerkUserId}`, 10, 60 * 60 * 1000)) {
      throw new ApiError("rate_limited", "Too many credential writes", 429)
    }
    const body = await request.json()
    if (body.kind !== "web_search" && body.kind !== "prices") {
      throw new ApiError("invalid", "kind must be web_search or prices")
    }
    const secret = String(body.secret ?? "")
    if (!secret) throw new ApiError("invalid", "secret required")
    const packed = encryptSecret(secret)
    await connect()
    await Credential.findOneAndUpdate(
      { userId: user._id, kind: body.kind },
      {
        userId: user._id,
        kind: body.kind,
        ...packed,
        last4: secret.slice(-4),
      },
      { upsert: true, returnDocument: "after" }
    )
    return NextResponse.json({ configured: true, last4: secret.slice(-4) })
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getSessionUser(request)
    const kind = new URL(request.url).searchParams.get("kind")
    if (kind !== "web_search" && kind !== "prices") {
      throw new ApiError("invalid", "kind required")
    }
    await connect()
    await Credential.deleteOne({ userId: user._id, kind })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
