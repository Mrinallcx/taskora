import { describe, expect, it } from "vitest"
import {
  RESEARCH_ORB_PHASES,
  isResearchingStatus,
  researchOrbPhase,
} from "./research-orb"

describe("research-orb", () => {
  it("walks thinking, planning, then solving", () => {
    const start = 1_000_000
    expect(RESEARCH_ORB_PHASES[researchOrbPhase(start, start)].label).toBe("Thinking")
    expect(RESEARCH_ORB_PHASES[researchOrbPhase(start, start + 8_000)].label).toBe(
      "Planning"
    )
    expect(RESEARCH_ORB_PHASES[researchOrbPhase(start, start + 16_000)].label).toBe(
      "Solving"
    )
    expect(RESEARCH_ORB_PHASES[researchOrbPhase(start, start + 24_000)].label).toBe(
      "Thinking"
    )
  })

  it("treats in-progress jobs as researching", () => {
    expect(isResearchingStatus("in_progress")).toBe(true)
    expect(isResearchingStatus("delivered")).toBe(false)
  })
})
