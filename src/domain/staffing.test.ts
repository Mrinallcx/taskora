import { describe, expect, it } from "vitest"

import { splitCentsByShares, staffJobListings } from "@/src/domain/staffing"

const seedWorker = {
  slug: "worker-research",
  kind: "worker",
  status: "live",
  skills: "web search, citations",
  ownerUserId: "platform",
}
const seedEval = {
  slug: "eval-research",
  kind: "evaluator",
  status: "live",
  skills: "citations, structure",
  ownerUserId: "platform",
}
const scribe = {
  slug: "scribe",
  kind: "worker",
  status: "live",
  skills: "long-form, citations",
  ownerUserId: "user-scribe",
}
const sourcer = {
  slug: "sourcer",
  kind: "worker",
  status: "live",
  skills: "web search, crypto",
  ownerUserId: "user-sourcer",
}
const cryptoEval = {
  slug: "crypto-eval",
  kind: "evaluator",
  status: "live",
  skills: "crypto, citations",
  ownerUserId: "user-eval",
}

describe("staffJobListings", () => {
  it("pins a hired worker on every stage", () => {
    const staffed = staffJobListings({
      ownerListing: scribe,
      proposed: [seedWorker, seedEval],
      planTasks: [{ type: "sources", listingSlug: sourcer.slug }],
      liveWorkers: [seedWorker, scribe, sourcer],
      liveEvals: [seedEval],
      defaultWorker: seedWorker,
      defaultEval: seedEval,
      need: ["crypto"],
    })
    expect(staffed.workersByType.sources.slug).toBe("scribe")
    expect(staffed.workersByType.report.slug).toBe("scribe")
  })

  it("honors per-stage listingSlug then a proposed worker", () => {
    const staffed = staffJobListings({
      proposed: [scribe, sourcer, seedEval],
      planTasks: [
        { type: "scope", listingSlug: scribe.slug },
        { type: "sources", listingSlug: sourcer.slug },
        { type: "findings", listingSlug: scribe.slug },
        { type: "report", listingSlug: scribe.slug },
      ],
      liveWorkers: [seedWorker, scribe, sourcer],
      liveEvals: [seedEval],
      defaultWorker: seedWorker,
      defaultEval: seedEval,
      need: [],
    })
    expect(staffed.workersByType.sources.slug).toBe("sourcer")
    expect(staffed.workersByType.report.slug).toBe("scribe")
  })

  it("skill-matches a live worker when the plan names none", () => {
    const staffed = staffJobListings({
      proposed: [seedEval],
      planTasks: [],
      liveWorkers: [seedWorker, sourcer],
      liveEvals: [seedEval, cryptoEval],
      defaultWorker: seedWorker,
      defaultEval: seedEval,
      need: ["crypto"],
    })
    expect(staffed.workersByType.sources.slug).toBe("sourcer")
    expect(staffed.evaluator.slug).toBe("crypto-eval")
  })

  it("falls back to seed listings", () => {
    const staffed = staffJobListings({
      proposed: [],
      planTasks: [],
      liveWorkers: [seedWorker],
      liveEvals: [seedEval],
      defaultWorker: seedWorker,
      defaultEval: seedEval,
      need: [],
    })
    expect(staffed.workersByType.scope.slug).toBe("worker-research")
    expect(staffed.evaluator.slug).toBe("eval-research")
  })
})

describe("splitCentsByShares", () => {
  it("keeps the remainder on the last share", () => {
    expect(splitCentsByShares(900, [1, 3])).toEqual([225, 675])
    expect(splitCentsByShares(10, [1, 1, 1]).reduce((sum, part) => sum + part, 0)).toBe(
      10
    )
  })
})
