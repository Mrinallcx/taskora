export type PayoutSplit = {
  leadCents: number
  workerCents: number
  evalCents: number
  feeCents: number
  refundCents: number
}

function assertSplit(split: PayoutSplit, escrow: number) {
  if (split.refundCents < 0) {
    throw new Error("refundCents is negative")
  }
  const sum =
    split.leadCents +
    split.workerCents +
    split.evalCents +
    split.feeCents +
    split.refundCents
  if (sum !== escrow) {
    throw new Error(`payout lines must sum to escrow (${sum} !== ${escrow})`)
  }
  return split
}

export function settleFull(escrow: number): PayoutSplit {
  const leadCents = Math.floor(0.35 * escrow)
  const workerCents = Math.floor(0.45 * escrow)
  const evalCents = Math.floor(0.12 * escrow)
  const feeCents = escrow - leadCents - workerCents - evalCents
  return assertSplit(
    {
      leadCents,
      workerCents,
      evalCents,
      feeCents,
      refundCents: 0,
    },
    escrow
  )
}

export function settlePartial(
  escrow: number,
  opts: {
    planApproved: boolean
    workerTasksPassedSchema: number
    evalSubmitted: boolean
  }
): PayoutSplit {
  const leadCents = opts.planApproved ? Math.floor(0.1 * escrow) : 0
  const workerCents =
    Math.floor(0.1125 * escrow) * opts.workerTasksPassedSchema
  const evalCents = opts.evalSubmitted ? Math.floor(0.12 * escrow) : 0
  const agentPay = leadCents + workerCents + evalCents
  const feeCents = agentPay === 0 ? 0 : Math.floor((agentPay * 8) / 92)
  const refundCents = escrow - leadCents - workerCents - evalCents - feeCents
  return assertSplit(
    { leadCents, workerCents, evalCents, feeCents, refundCents },
    escrow
  )
}

export function splitSumsToEscrow(split: PayoutSplit, escrow: number) {
  return (
    split.leadCents +
      split.workerCents +
      split.evalCents +
      split.feeCents +
      split.refundCents ===
    escrow
  )
}
