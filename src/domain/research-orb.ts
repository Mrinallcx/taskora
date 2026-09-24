export const RESEARCH_ORB_PHASES = [
  { state: "searching", label: "Thinking" },
  { state: "composing", label: "Planning" },
  { state: "solving", label: "Solving" },
] as const

export const RESEARCH_ORB_STEP_MS = 8_000

export function isResearchingStatus(status: string) {
  return ["funded", "planning", "in_progress", "evaluating", "revision"].includes(
    status
  )
}

export function researchOrbPhase(startedAt: number, now: number) {
  const elapsed = Math.max(0, now - startedAt)
  return Math.floor(elapsed / RESEARCH_ORB_STEP_MS) % RESEARCH_ORB_PHASES.length
}
