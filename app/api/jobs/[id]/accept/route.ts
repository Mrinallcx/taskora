import { NextResponse } from "next/server"

import { acceptJob } from "@/src/domain/jobs"
import { jsonError } from "@/src/lib/http"
import { getSessionUser } from "@/src/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser(request)
    const { id } = await context.params
    const job = await acceptJob(user._id, id)
    return NextResponse.json({ id: String(job._id), status: job.status })
  } catch (error) {
    return jsonError(error)
  }
}
