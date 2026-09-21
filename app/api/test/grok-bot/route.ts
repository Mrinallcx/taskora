import { NextResponse } from "next/server"

import { createGrokBotJob } from "@/src/domain/grok-bot"
import { ApiError } from "@/src/domain/errors"
import { jsonError } from "@/src/lib/http"
import { getSessionUser } from "@/src/lib/auth"
import { hex } from "@/src/lib/ids"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({
    configured: Boolean(process.env.GROK_BOT_WEBHOOK_URL?.trim()),
    local: process.env.NODE_ENV !== "production",
  })
}

export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV === "production") {
      throw new ApiError("forbidden", "Grok Bot test is local only", 403)
    }
    const user = await getSessionUser(request)
    const body = (await request.json().catch(() => ({}))) as {
      brief?: string
      webhookUrl?: string
      webhookKey?: string
      callbackBase?: string
    }
    const testAuth = (request.headers.get("authorization") ?? "").startsWith(
      "Bearer test:"
    )
    const created = await createGrokBotJob(user, {
      brief: body.brief,
      webhookUrl: testAuth ? body.webhookUrl : undefined,
      webhookKey: testAuth ? body.webhookKey : undefined,
      callbackBase: testAuth ? body.callbackBase : undefined,
    })
    return NextResponse.json({
      id: hex(created.job._id),
      status: created.job.status,
      ping: {
        pinged: created.ping.pinged,
        reason: created.ping.reason,
        status: created.ping.status,
        body: created.ping.body ?? "",
      },
      dashboardPath: `/dashboard/${hex(created.job._id)}`,
    })
  } catch (error) {
    return jsonError(error)
  }
}
