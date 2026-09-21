import { NextResponse } from "next/server"

import { connect } from "@/src/db/connect"
import { UserApp } from "@/src/db/models"
import { encryptSecret } from "@/src/crypto/secrets"
import { jsonError } from "@/src/lib/http"
import { getSessionUser } from "@/src/lib/auth"
import { asObjectId, hex } from "@/src/lib/ids"
import { ApiError } from "@/src/domain/errors"
import { rateLimit } from "@/src/domain/rate-limit"
import {
  catalogItemForUrl,
  normalizeMcpUrl,
  type McpAuth,
  type McpCategory,
} from "@/src/domain/mcp-catalog"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const AUTHS = new Set<McpAuth>(["oauth", "apikey", "open"])

function parseHttpUrl(raw: string) {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new ApiError("invalid", "A valid server URL is required", 400)
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ApiError("invalid", "Server URL must be http or https", 400)
  }
  return parsed.toString()
}

function serialize(row: {
  _id: { toString(): string }
  name: string
  url: string
  auth: string
  category: string
  maintainer: string
  custom: boolean
  last4?: string
  status?: string
}) {
  return {
    id: hex(row._id),
    name: row.name,
    url: row.url,
    auth: row.auth,
    category: row.category,
    maintainer: row.maintainer,
    custom: row.custom,
    last4: row.last4 || undefined,
    status: row.status === "needs_auth" ? "needs_auth" : "ready",
  }
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request)
    await connect()
    const rows = await UserApp.find({ userId: user._id }).sort({ createdAt: -1 })
    return NextResponse.json({ servers: rows.map(serialize) })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request)
    if (!rateLimit(`apps:${user.clerkUserId}`, 40, 60 * 60 * 1000)) {
      throw new ApiError("rate_limited", "Too many app writes", 429)
    }
    const body = await request.json()
    const name = String(body.name ?? "").trim()
    const url = normalizeMcpUrl(parseHttpUrl(String(body.url ?? "").trim()))
    const auth = String(body.auth ?? "") as McpAuth
    if (!name) throw new ApiError("invalid", "name required", 400)
    if (!AUTHS.has(auth)) {
      throw new ApiError("invalid", "auth must be oauth, apikey, or open", 400)
    }

    const catalog = catalogItemForUrl(url)
    const category = String(
      body.category ?? catalog?.category ?? "other"
    ) as Exclude<McpCategory, "all">
    const maintainer = String(body.maintainer ?? catalog?.maintainer ?? "")
    const custom = Boolean(body.custom) || !catalog
    const headerName = String(
      body.headerName ?? catalog?.fields?.[0]?.headerName ?? "Authorization"
    )
    const secret = String(body.secret ?? body.apiKey ?? "").trim()

    if (auth === "apikey" && !secret) {
      throw new ApiError("invalid", "API key required", 400)
    }

    const packed = secret ? encryptSecret(secret) : null
    const status =
      auth === "oauth" && !secret ? "needs_auth" : "ready"

    await connect()
    const row = await UserApp.findOneAndUpdate(
      { userId: user._id, url },
      {
        userId: user._id,
        name: catalog?.name ?? name,
        url,
        auth: catalog?.auth ?? auth,
        category: catalog?.category ?? category,
        maintainer,
        headerName,
        custom,
        status,
        ...(packed
          ? { ...packed, last4: secret.slice(-4) }
          : { iv: "", tag: "", ciphertext: "", last4: "" }),
      },
      { upsert: true, returnDocument: "after" }
    )
    if (!row) throw new ApiError("invalid", "Could not save app", 500)
    return NextResponse.json({ server: serialize(row) })
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getSessionUser(request)
    const id = new URL(request.url).searchParams.get("id")
    const objectId = id ? asObjectId(id) : null
    if (!objectId) throw new ApiError("invalid", "id required", 400)
    await connect()
    await UserApp.deleteOne({ _id: objectId, userId: user._id })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
