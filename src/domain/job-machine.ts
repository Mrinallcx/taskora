export const JOB_STATUSES = [
  "draft",
  "funded",
  "planning",
  "plan_review",
  "staffing",
  "in_progress",
  "evaluating",
  "revision",
  "delivered",
  "disputed",
  "settled",
  "cancelled",
] as const

export type JobStatus = (typeof JOB_STATUSES)[number]

export type JobEvent =
  | "fund"
  | "planning"
  | "lead_ok"
  | "lead_fail"
  | "approve"
  | "stop"
  | "staffed"
  | "report_ok"
  | "eval_pass"
  | "eval_fail_revise"
  | "eval_fail_cancel"
  | "revision_queued"
  | "dispute"
  | "accept"
  | "resolve_cancelled"
  | "resolve_settled"

const TABLE: Partial<Record<JobStatus, Partial<Record<JobEvent, JobStatus>>>> = {
  draft: { fund: "funded" },
  funded: { planning: "planning", stop: "cancelled" },
  planning: { lead_ok: "plan_review", lead_fail: "cancelled", stop: "cancelled" },
  plan_review: { approve: "staffing", stop: "cancelled" },
  staffing: { staffed: "in_progress", stop: "cancelled" },
  in_progress: { report_ok: "evaluating", stop: "cancelled" },
  evaluating: {
    eval_pass: "delivered",
    eval_fail_revise: "revision",
    eval_fail_cancel: "cancelled",
    stop: "cancelled",
  },
  revision: { revision_queued: "in_progress", stop: "cancelled" },
  delivered: { dispute: "disputed", accept: "settled" },
  disputed: { resolve_cancelled: "cancelled", resolve_settled: "settled" },
}

export function transition(from: JobStatus, event: JobEvent): JobStatus {
  const next = TABLE[from]?.[event]
  if (!next) {
    throw new Error(`Illegal job transition: ${from} --${event}-->`)
  }
  return next
}

export function canStop(status: JobStatus) {
  return (
    status === "funded" ||
    status === "planning" ||
    status === "plan_review" ||
    status === "staffing" ||
    status === "in_progress" ||
    status === "evaluating" ||
    status === "revision"
  )
}
