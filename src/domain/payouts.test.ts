import { describe, expect, it } from "vitest"

import { settleFull, settlePartial, splitSumsToEscrow } from "@/src/domain/payouts"

describe("P1-LEDGER payouts", () => {
  it("P1-LEDGER-03 settleFull refunds 0 and sums at odd escrows", () => {
    for (const escrow of [100, 2000, 2001, 9999]) {
      const split = settleFull(escrow)
      expect(split.refundCents).toBe(0)
      expect(splitSumsToEscrow(split, escrow)).toBe(true)
    }
  })

  it("P1-LEDGER-02 refundCents is never negative", () => {
    const cases = [
      { planApproved: false, workerTasksPassedSchema: 0, evalSubmitted: false },
      { planApproved: true, workerTasksPassedSchema: 0, evalSubmitted: false },
      { planApproved: true, workerTasksPassedSchema: 2, evalSubmitted: false },
      { planApproved: true, workerTasksPassedSchema: 4, evalSubmitted: true },
    ]
    for (const escrow of [100, 2000, 2001, 9999]) {
      for (const opts of cases) {
        const split = settlePartial(escrow, opts)
        expect(split.refundCents).toBeGreaterThanOrEqual(0)
        expect(splitSumsToEscrow(split, escrow)).toBe(true)
      }
    }
  })
})
