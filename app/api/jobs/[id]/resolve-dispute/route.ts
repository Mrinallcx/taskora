import { NextResponse } from "next/server"

import { resolveDispute } from "@/src/domain/jobs"
import { jsonError } from "@/src/lib/http"
import { getSessionUser } from "@/src/lib/auth"
import { ApiError } from "@/src/domain/errors"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser(request)
    const { id } = await context.params
    const body = await request.json()
    if (body.outcome !== "cancelled" && body.outcome !== "settled") {
      throw new ApiError("invalid", "Outcome must be cancelled or settled")
    }
    const job = await resolveDispute(user._id, id, body.outcome)
    return NextResponse.json({ id: String(job._id), status: job.status })
  } catch (error) {
    return jsonError(error)
  }
}
