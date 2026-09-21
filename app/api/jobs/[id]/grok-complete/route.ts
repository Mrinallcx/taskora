import { NextResponse } from "next/server"

import { applyGrokBotMemo, grokCallbackTokenOk } from "@/src/domain/grok-bot"
import { ApiError } from "@/src/domain/errors"
import { jsonError } from "@/src/lib/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const url = new URL(request.url)
    const header = request.headers.get("authorization") ?? ""
    const token =
      url.searchParams.get("token") ||
      (header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "")
    if (!grokCallbackTokenOk(id, token)) {
      throw new ApiError("unauthorized", "Callback token required", 401)
    }
    const body = await request.json().catch(() => ({}))
    const result = await applyGrokBotMemo(id, body)
    return NextResponse.json({
      id,
      status: result.job.status,
      chars: result.markdown.length,
    })
  } catch (error) {
    return jsonError(error)
  }
}
