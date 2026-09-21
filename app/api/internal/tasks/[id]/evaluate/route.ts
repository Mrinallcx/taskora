import { NextResponse } from "next/server"

import { evaluateTask } from "@/src/domain/jobs"
import { jsonError } from "@/src/lib/http"
import { workerAuthorized } from "@/src/lib/auth"
import { ApiError } from "@/src/domain/errors"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!workerAuthorized(request)) {
      throw new ApiError("unauthorized", "Worker secret required", 401)
    }
    const { id } = await context.params
    const body = await request.json()
    const job = await evaluateTask(id, body)
    return NextResponse.json({ id: String(job._id), status: job.status })
  } catch (error) {
    return jsonError(error)
  }
}
