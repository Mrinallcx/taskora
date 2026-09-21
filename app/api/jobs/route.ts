import { NextResponse } from "next/server"

import { Job } from "@/src/db/models"
import { connect } from "@/src/db/connect"
import { createJob } from "@/src/domain/jobs"
import { rateLimit } from "@/src/domain/rate-limit"
import { ApiError } from "@/src/domain/errors"
import { jsonError } from "@/src/lib/http"
import { getSessionUser } from "@/src/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request)
    await connect()
    const jobs = await Job.find({ userId: user._id }).sort({ createdAt: -1 })
    return NextResponse.json({
      jobs: jobs.map((job) => ({
        id: String(job._id),
        status: job.status,
        domain: job.domain,
        brief: job.brief,
        instructions: job.instructions,
        budgetCents: job.budgetCents,
        escrowCents: job.escrowCents,
        createdAt: job.createdAt,
      })),
    })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request)
    if (!rateLimit(`jobs:${user.clerkUserId}`, 30, 60 * 60 * 1000)) {
      throw new ApiError("rate_limited", "Too many jobs", 429)
    }
    const body = await request.json()
    const job = await createJob(user, body)
    return NextResponse.json({ id: String(job._id), status: job.status })
  } catch (error) {
    return jsonError(error)
  }
}
