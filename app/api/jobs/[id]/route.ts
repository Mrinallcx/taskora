import { NextResponse } from "next/server"

import { connect } from "@/src/db/connect"
import {
  Artifact,
  Evaluation,
  Event,
  Invocation,
  Job,
  JobPlan,
  Ledger,
  Snapshot,
  Task,
} from "@/src/db/models"
import { jobToolPack } from "@/src/domain/jobs"
import { computeCoverage } from "@/src/domain/evidence"
import { staffingCaption, staffingForJobs } from "@/src/domain/listing-history"
import { ApiError } from "@/src/domain/errors"
import { jsonError } from "@/src/lib/http"
import { getSessionUser } from "@/src/lib/auth"
import { asObjectId, hex } from "@/src/lib/ids"

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
    const [plan, tasks, artifacts, evaluations, events, ledger, staffMap, snapshots, searches] =
      await Promise.all([
        job.planId ? JobPlan.findById(job.planId) : null,
        Task.find({ jobId: job._id }).sort({ createdAt: 1 }),
        Artifact.find({ jobId: job._id }).sort({ round: 1, attempt: 1 }),
        Evaluation.find({ jobId: job._id }).sort({ round: 1 }),
        Event.find({ jobId: job._id }).sort({ at: 1 }),
        Ledger.find({ jobId: job._id }),
        staffingForJobs([job]),
        Snapshot.find({ jobId: job._id }).select("toolName"),
        Invocation.countDocuments({ jobId: job._id, tool: "web_search" }),
      ])
    const staff = staffMap.get(hex(job._id))
    const reportTask = [...tasks].reverse().find((row) => row.type === "report")
    const reportArtifact = reportTask
      ? [...artifacts].reverse().find((row) => hex(row.taskId) === hex(reportTask._id))
      : null
    const payload = (reportArtifact?.payload ?? {}) as { citationIds?: string[] }
    const citationIds = [
      ...(payload.citationIds ?? []),
      ...((reportArtifact?.citations ?? []) as { snapshotId?: string }[])
        .map((row) => row.snapshotId)
        .filter((id): id is string => Boolean(id)),
    ]
    const coverage = computeCoverage({
      searches,
      snapshots,
      citationIds,
    })
    const terminal = job.status === "settled" || job.status === "cancelled"
    const receipt = terminal
      ? {
          lines: ledger.map((row) => ({
            role: row.role,
            cents: row.cents,
            payeeUserId: row.payeeUserId,
          })),
          refundCents: ledger.find((row) => row.role === "user_refund")?.cents ?? 0,
          computeSpentCents: job.computeSpentCents,
        }
      : null
    return NextResponse.json({
      job,
      plan,
      tasks,
      artifacts: artifacts.map((row) => ({
        _id: hex(row._id),
        taskId: hex(row.taskId),
        markdown: row.markdown,
        payload: row.payload,
        citations: row.citations,
      })),
      evaluations,
      events,
      receipt,
      staffing: staff ? staffingCaption(staff) : "",
      toolPack: jobToolPack(job.domain),
      coverage,
    })
  } catch (error) {
    return jsonError(error)
  }
}
