import { NextResponse } from "next/server"

import { connect } from "@/src/db/connect"
import { Artifact, Job, Ledger, Snapshot, Task } from "@/src/db/models"
import { ApiError } from "@/src/domain/errors"
import { jsonError } from "@/src/lib/http"
import { getSessionUser } from "@/src/lib/auth"
import { asObjectId } from "@/src/lib/ids"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser(request)
    const { id } = await context.params
    const objectId = asObjectId(id)
    if (!objectId) throw new ApiError("not_found", "Job not found", 404)
    await connect()
    const job = await Job.findOne({ _id: objectId, userId: user._id })
    if (!job) throw new ApiError("not_found", "Job not found", 404)
    const file = new URL(request.url).searchParams.get("file")

    if (file === "memo.md") {
      const reportTask = await Task.findOne({ jobId: job._id, type: "report" })
      const artifact = await Artifact.findOne({ taskId: reportTask?._id }).sort({
        round: -1,
        attempt: -1,
      })
      const markdown = String(artifact?.payload?.markdown ?? artifact?.markdown ?? "")
      if (!markdown) throw new ApiError("not_found", "Report not ready", 404)
      return new NextResponse(markdown, {
        headers: { "Content-Type": "text/markdown; charset=utf-8" },
      })
    }

    if (file === "sources.json") {
      const snapshots = await Snapshot.find({ jobId: job._id })
      if (snapshots.length === 0) {
        throw new ApiError("not_found", "No sources yet", 404)
      }
      return NextResponse.json(
        snapshots.map((row) => ({
          id: String(row._id),
          url: row.url,
          sha256: row.sha256,
          toolName: row.toolName,
        }))
      )
    }

    if (file === "receipt.json") {
      if (job.status !== "settled" && job.status !== "cancelled") {
        throw new ApiError("not_found", "Receipt not ready", 404)
      }
      const lines = await Ledger.find({ jobId: job._id })
      return NextResponse.json({
        status: job.status,
        escrowCents: job.escrowCents,
        lines,
      })
    }

    throw new ApiError("invalid", "Unknown file")
  } catch (error) {
    return jsonError(error)
  }
}
