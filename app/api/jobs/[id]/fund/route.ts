import { NextResponse } from "next/server"

import { fundJob } from "@/src/domain/jobs"
import { jsonError } from "@/src/lib/http"
import { getSessionUser } from "@/src/lib/auth"
import { rateLimit } from "@/src/domain/rate-limit"
import { ApiError } from "@/src/domain/errors"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser(request)
    if (!rateLimit(`act:${user.clerkUserId}`, 60, 60 * 60 * 1000)) {
      throw new ApiError("rate_limited", "Too many actions", 429)
    }
    const { id } = await context.params
    const job = await fundJob(user._id, id)
    return NextResponse.json({ id: String(job._id), status: job.status })
  } catch (error) {
    return jsonError(error)
  }
}
