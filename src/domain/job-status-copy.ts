import { stockJobAssignmentCopy } from "@/src/domain/stock-workers"

export function statusCopy(
  status: string,
  name?: string,
  assignment?: { workerQueued?: boolean; workerId?: string }
) {
  const who = name?.trim() || "Research desk"
  if (["delivered", "settled"].includes(status)) return "Work is done."
  if (status === "cancelled") return "Run stopped"
  if (
    ["funded", "planning", "in_progress", "evaluating", "revision"].includes(
      status
    )
  ) {
    if (assignment?.workerQueued || assignment?.workerId) {
      return stockJobAssignmentCopy(assignment)
    }
    return `${who} is researching`
  }
  if (status === "plan_review") return "Plan needs approval"
  if (status === "disputed") return "Under dispute"
  return "Waiting to start"
}

export function startedOn(value: Date | string | undefined) {
  if (!value) return "Opened from Launch Agent"
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
