import { describe, expect, it } from "vitest"

import { lastJobPerWorker, staffingCaption } from "@/src/domain/listing-history"

describe("staffingCaption", () => {
  it("says the agent hired the worker", () => {
    expect(
      staffingCaption({
        agentName: "Scout",
        workerNames: ["Research worker"],
        hiredKind: "lead",
      })
    ).toBe("Scout hired Research worker")
  })

  it("says you hired a pinned worker", () => {
    expect(
      staffingCaption({
        agentName: "Scout",
        workerNames: ["Scribe"],
        hiredKind: "worker",
      })
    ).toBe("You hired Scribe")
  })
})

describe("lastJobPerWorker", () => {
  it("keeps each worker's newest job", () => {
    const staffing = new Map([
      [
        "job-new",
        {
          workerNames: ["Research worker"],
          workerIds: ["worker-1"],
        },
      ],
      [
        "job-old",
        {
          workerNames: ["Research worker", "Scribe"],
          workerIds: ["worker-1", "worker-2"],
        },
      ],
    ])
    expect(
      lastJobPerWorker([{ _id: "job-new" }, { _id: "job-old" }], staffing)
    ).toEqual([
      { workerId: "worker-1", workerName: "Research worker", jobId: "job-new" },
      { workerId: "worker-2", workerName: "Scribe", jobId: "job-old" },
    ])
  })
})
