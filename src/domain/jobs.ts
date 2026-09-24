import type { ClientSession } from "mongoose"

import { connect, sessionOpts, withSession } from "@/src/db/connect"
import {
  Artifact,
  Assignment,
  Evaluation,
  Event,
  Job,
  JobPlan,
  Ledger,
  Listing,
  Merchant,
  Snapshot,
  Task,
  User,
} from "@/src/db/models"
import { isIndependent, toolsForDomain } from "@/src/domain/allowlists"
import { isCitableTool } from "@/src/domain/evidence"
import { denylistHit } from "@/src/domain/denylist"
import {
  ensureResearchHandoffListing,
  grokBotEnabledForJob,
} from "@/src/domain/grok-bot"
import { isStockPoolJob } from "@/src/domain/stock-workers"
import { assignNextQueuedStockJob, assignStockWorkerOrQueue } from "@/src/domain/stock-worker-runtime"
import { resolveFinanceAsset } from "@/src/domain/finance-asset"
import {
  isLaunchCategory,
  resolveNasdaqStocks,
} from "@/src/domain/stock-listings"
import { briefStockMismatch } from "@/src/domain/stock-scope"
import { ApiError } from "@/src/domain/errors"
import { needFromBrief } from "@/src/domain/skills"
import {
  splitCentsByShares,
  staffJobListings,
  WORKER_STAGE_TYPES,
} from "@/src/domain/staffing"
import {
  computeHardFails,
  computeVerdict,
  type Scores,
} from "@/src/domain/hard-fails"
import { canStop, transition, type JobStatus } from "@/src/domain/job-machine"
import { settleFull, settlePartial } from "@/src/domain/payouts"
import { notifyJobDelivered } from "@/src/lib/notify"
import { timeoutMs } from "@/src/domain/timeouts"
import { asObjectId, hex } from "@/src/lib/ids"
import { ownedAppIds } from "@/src/domain/user-apps"

async function emit(
  jobId: unknown,
  type: string,
  payload: Record<string, unknown> = {},
  session: ClientSession | null = null
) {
  await Event.create([{ jobId, type, payload, at: new Date() }], sessionOpts(session))
}

async function workerPassedCount(jobId: unknown, session: ClientSession | null) {
  return Task.countDocuments(
    {
      jobId,
      type: { $in: ["scope", "sources", "findings", "report"] },
      status: "passed_schema",
    },
    sessionOpts(session)
  )
}

function domainFromBrief(brief: string) {
  if (resolveFinanceAsset(brief)) return "finance"
  if (/\bacademic\b|\bdoi\b|\bpaper(s)?\b|\bjournal\b/i.test(brief)) return "academic"
  return "general"
}

function slugifyAgent(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
  return `${base || "agent"}-${Math.random().toString(36).slice(2, 8)}`
}

export async function createJob(
  user: { _id: unknown; clerkUserId: string },
  body: {
    brief: string
    name?: string
    instructions?: string
    category?: string
    symbol?: string
    symbols?: string[]
    domain?: string
    budgetCents?: number
    computeBudgetCents?: number
    useUserSearch?: boolean
    useUserPrices?: boolean
    useAppIds?: string[]
    fallbackToPlatform?: boolean
    listingId?: unknown
    isPublic?: boolean
    underMerchant?: boolean
    autoApprovePlan?: boolean
    emailOnDeliver?: boolean
    notifyEmail?: string
  }
) {
  await connect()
  const brief = body.brief?.trim() ?? ""
  if (!brief || brief.length > 8000) {
    throw new ApiError("invalid", "Brief is required and must be under 8k chars")
  }
  const name = (body.name ?? "").trim()
  if (name.length > 80) {
    throw new ApiError("invalid", "Name must be under 80 characters")
  }
  const instructions = (body.instructions ?? "").trim()
  if (instructions.length > 8000) {
    throw new ApiError("invalid", "Instructions must be under 8k chars")
  }
  if (denylistHit(brief) || denylistHit(instructions) || denylistHit(name)) {
    throw new ApiError("denylist", "Brief hits the denylist", 400)
  }
  const requested = [
    ...(Array.isArray(body.symbols) ? body.symbols : []),
    body.symbol ?? "",
  ]
  const category = isLaunchCategory(body.category)
    ? body.category
    : requested.some((row) => String(row ?? "").trim())
      ? "stocks"
      : ""
  let symbol = ""
  let companyName = ""
  let exchange = ""
  let symbols: { symbol: string; name: string; exchange: string }[] = []
  if (category === "stocks") {
    const listings = await resolveNasdaqStocks(requested)
    symbols = listings.map((row) => ({
      symbol: row.symbol,
      name: row.name,
      exchange: row.exchange,
    }))
    symbol = listings[0].symbol
    companyName = listings[0].name
    exchange = listings[0].exchange
    const mismatch = briefStockMismatch(brief, instructions, listings)
    if (mismatch) throw new ApiError("invalid", mismatch)
  }
  const domain =
    category === "stocks"
      ? "finance"
      : body.domain && ["general", "finance", "academic"].includes(body.domain)
        ? body.domain
        : domainFromBrief(`${brief}\n${instructions}`)
  const budgetCents = body.budgetCents ?? 2000
  if (budgetCents < 2000 || budgetCents > 10000) {
    throw new ApiError("budget", "Budget must be between 2000 and 10000 cents")
  }
  const computeBudgetCents = body.computeBudgetCents ?? 500
  if (computeBudgetCents < 50 || computeBudgetCents > 2000) {
    throw new ApiError("budget", "Compute budget must be between 50 and 2000 cents")
  }
  let listingId = body.listingId
  if (listingId) {
    const id = typeof listingId === "string" ? asObjectId(listingId) : listingId
    if (!id) throw new ApiError("invalid", "Invalid listing", 400)
    const listing = await Listing.findById(id)
    if (!listing || listing.status !== "live") {
      throw new ApiError("not_found", "Listing not found", 404)
    }
    if (listing.kind === "evaluator") {
      throw new ApiError("invalid", "This listing cannot be hired for a job", 400)
    }
    const owner = hex(user._id as { toString(): string })
    if (!listing.isPublic && listing.ownerUserId !== owner) {
      const branded =
        Boolean(listing.underMerchant) &&
        (await Merchant.exists({
          ownerUserId: listing.ownerUserId,
          status: "live",
          isPublic: true,
        }))
      if (!branded) throw new ApiError("not_found", "Listing not found", 404)
    }
    listingId = listing._id
  }
  const useAppIds = await ownedAppIds(user._id, body.useAppIds)
  const owner = hex(user._id as { toString(): string })
  const underMerchant =
    Boolean(body.underMerchant) &&
    Boolean(await Merchant.exists({ ownerUserId: owner }))
  const isPublic = Boolean(body.isPublic)
  if (!listingId && (isPublic || underMerchant)) {
    const listing = await Listing.create({
      slug: slugifyAgent(name || brief),
      kind: "lead",
      ownerUserId: owner,
      vertical: "research",
      priceCents: budgetCents,
      runtime: "hosted_prompt",
      status: "live",
      name: name || brief.slice(0, 80),
      summary: brief.slice(0, 2000),
      prompt: instructions,
      tools: toolsForDomain(domain),
      isPublic,
      underMerchant,
      defaultBrief: brief,
    })
    listingId = listing._id
  }
  const job = await Job.create({
    userId: user._id,
    clerkUserId: user.clerkUserId,
    domain,
    brief,
    name,
    instructions,
    category,
    symbol,
    companyName,
    exchange,
    symbols,
    status: "draft",
    budgetCents,
    computeBudgetCents,
    useUserSearch: Boolean(body.useUserSearch),
    useUserPrices: Boolean(body.useUserPrices),
    useAppIds,
    fallbackToPlatform: Boolean(body.fallbackToPlatform),
    listingId,
    isPublic,
    underMerchant,
    autoApprovePlan: Boolean(body.autoApprovePlan),
    emailOnDeliver: Boolean(body.emailOnDeliver),
    notifyEmail: body.notifyEmail ?? "",
  })
  await emit(job._id, "job_created", { domain, category, budgetCents })
  return job
}

export async function fundJob(userId: unknown, jobId: string) {
  const id = asObjectId(jobId)
  if (!id) throw new ApiError("not_found", "Job not found", 404)
  const existing = await Job.findOne({ _id: id, userId }).select(
    "category domain symbol symbols"
  )
  if (existing && grokBotEnabledForJob(existing)) {
    return fundJobViaGrokBot(userId, id)
  }
  const defaultLead =
    (await Listing.findOne({ slug: "lead-research", status: "live" })) ||
    (await ensureResearchHandoffListing())

  return withSession(async (session) => {
    const job = await Job.findOne({ _id: id, userId }, null, sessionOpts(session))
    if (!job) throw new ApiError("not_found", "Job not found", 404)
    if (job.status !== "draft") throw new ApiError("conflict", "Job already funded", 409)

    const hired = job.listingId
      ? await Listing.findById(job.listingId, null, sessionOpts(session))
      : null
    const lead =
      hired?.kind === "lead" && hired.status === "live" ? hired : defaultLead

    const user = await User.findById(userId, null, sessionOpts(session))
    if (!user) throw new ApiError("not_found", "User not found", 404)
    if (user.availableCents < job.budgetCents) {
      throw new ApiError("budget", "Not enough play money", 400)
    }

    user.availableCents -= job.budgetCents
    user.escrowedCents += job.budgetCents
    await user.save(sessionOpts(session))

    job.escrowCents = job.budgetCents
    job.status = transition("draft", "fund")
    job.status = transition("funded", "planning")
    await job.save(sessionOpts(session))

    const [task] = await Task.create(
      [
        {
          jobId: job._id,
          type: "plan",
          status: "queued",
          listingId: lead._id,
          attempt: 1,
          timeoutMs: timeoutMs("plan"),
        },
      ],
      sessionOpts(session)
    )
    await Assignment.create(
      [
        {
          taskId: task._id,
          jobId: job._id,
          listingId: lead._id,
          ownerUserId: lead.ownerUserId,
          role: "lead",
        },
      ],
      sessionOpts(session)
    )
    await emit(job._id, "funded", { escrowCents: job.escrowCents }, session)
    await emit(job._id, "plan_queued", {}, session)
    return job
  })
}

async function fundJobViaGrokBot(
  userId: unknown,
  id: NonNullable<ReturnType<typeof asObjectId>>
) {
  const job = await withSession(async (session) => {
    const row = await Job.findOne({ _id: id, userId }, null, sessionOpts(session))
    if (!row) throw new ApiError("not_found", "Job not found", 404)
    if (row.status !== "draft") throw new ApiError("conflict", "Job already funded", 409)
    const user = await User.findById(userId, null, sessionOpts(session))
    if (!user) throw new ApiError("not_found", "User not found", 404)
    if (user.availableCents < row.budgetCents) {
      throw new ApiError("budget", "Not enough play money", 400)
    }
    user.availableCents -= row.budgetCents
    user.escrowedCents += row.budgetCents
    await user.save(sessionOpts(session))
    row.escrowCents = row.budgetCents
    row.status = "in_progress"
    await row.save(sessionOpts(session))
    await emit(row._id, "funded", { escrowCents: row.escrowCents, via: "grok_bot" }, session)
    return row
  })
  await assignStockWorkerOrQueue(job)
  return job
}

async function creditPayee(
  payeeUserId: string,
  cents: number,
  session: ClientSession | null
) {
  if (cents <= 0 || !payeeUserId || payeeUserId === "platform") return
  const id = asObjectId(payeeUserId)
  if (!id) return
  await User.updateOne(
    { _id: id },
    { $inc: { availableCents: cents } },
    sessionOpts(session)
  )
}

async function workerPayoutLines(
  jobId: unknown,
  workerCents: number,
  session: ClientSession | null
) {
  if (workerCents <= 0) return []
  const [tasks, assigns] = await Promise.all([
    Task.find(
      { jobId, type: { $in: [...WORKER_STAGE_TYPES] } },
      null,
      sessionOpts(session)
    ),
    Assignment.find({ jobId, role: "worker" }, null, sessionOpts(session)),
  ])
  const ownerByListing = new Map(
    assigns.map((row) => [hex(row.listingId), row.ownerUserId])
  )
  const groups = new Map<
    string,
    { listingId: unknown; ownerUserId: string; passed: number }
  >()
  for (const task of tasks) {
    const key = hex(task.listingId)
    const current = groups.get(key)
    const passed = task.status === "passed_schema" ? 1 : 0
    if (current) {
      current.passed += passed
      continue
    }
    groups.set(key, {
      listingId: task.listingId,
      ownerUserId: ownerByListing.get(key) ?? "platform",
      passed,
    })
  }
  const rows = [...groups.values()]
  if (rows.length === 0) {
    return [
      {
        role: "worker" as const,
        cents: workerCents,
        payeeUserId: "platform",
        listingId: undefined as unknown,
      },
    ]
  }
  const shares = rows.map((row) => row.passed)
  const weight = shares.reduce((sum, share) => sum + share, 0)
  const parts = splitCentsByShares(
    workerCents,
    weight > 0 ? shares : rows.map(() => 1)
  )
  return rows.map((row, index) => ({
    role: "worker" as const,
    cents: parts[index] ?? 0,
    payeeUserId: row.ownerUserId || "platform",
    listingId: row.listingId,
  }))
}

async function writeLedger(
  job: { _id: unknown; userId: unknown; escrowCents: number },
  split: ReturnType<typeof settleFull>,
  session: ClientSession | null
) {
  const userPayee = hex(job.userId as { toString(): string })
  const lead = await Assignment.findOne(
    { jobId: job._id, role: "lead" },
    null,
    sessionOpts(session)
  )
  const evaluator = await Assignment.findOne(
    { jobId: job._id, role: "evaluator" },
    null,
    sessionOpts(session)
  )
  const workers = await workerPayoutLines(job._id, split.workerCents, session)
  const lines = [
    {
      role: "lead" as const,
      cents: split.leadCents,
      payeeUserId: lead?.ownerUserId || "platform",
      listingId: lead?.listingId,
    },
    ...workers,
    {
      role: "evaluator" as const,
      cents: split.evalCents,
      payeeUserId: evaluator?.ownerUserId || "platform",
      listingId: evaluator?.listingId,
    },
    {
      role: "platform_fee" as const,
      cents: split.feeCents,
      payeeUserId: "platform",
      listingId: undefined,
    },
    {
      role: "user_refund" as const,
      cents: split.refundCents,
      payeeUserId: userPayee,
      listingId: undefined,
    },
  ]

  for (const line of lines) {
    if (line.cents <= 0) continue
    const listingKey = line.listingId ? hex(line.listingId) : "none"
    const key = `settle:${hex(job._id as { toString(): string })}:${line.role}:${line.payeeUserId}:${listingKey}`
    try {
      await Ledger.create(
        [
          {
            jobId: job._id,
            payeeUserId: line.payeeUserId,
            role: line.role,
            listingId: line.listingId,
            cents: line.cents,
            idempotencyKey: key,
          },
        ],
        sessionOpts(session)
      )
      if (line.role !== "user_refund") {
        await creditPayee(line.payeeUserId, line.cents, session)
      }
    } catch (error) {
      const code = (error as { code?: number }).code
      if (code !== 11000) throw error
    }
  }
}

export async function settleJob(
  jobId: unknown,
  kind: "full" | "partial",
  extra: {
    planApproved: boolean
    workerTasksPassedSchema: number
    evalSubmitted: boolean
  },
  session: ClientSession | null = null
) {
  const job = await Job.findById(jobId, null, sessionOpts(session))
  if (!job) throw new ApiError("not_found", "Job not found", 404)
  const already = await Ledger.findOne({ jobId: job._id }, null, sessionOpts(session))
  const split =
    kind === "full"
      ? settleFull(job.escrowCents)
      : settlePartial(job.escrowCents, extra)
  await writeLedger(job, split, session)
  if (already) return split
  const user = await User.findById(job.userId, null, sessionOpts(session))
  if (user) {
    user.escrowedCents -= job.escrowCents
    user.availableCents += split.refundCents
    await user.save(sessionOpts(session))
  }
  return split
}

export async function stopJob(userId: unknown, jobId: string, reason = "user_stop") {
  const id = asObjectId(jobId)
  if (!id) throw new ApiError("not_found", "Job not found", 404)
  const cancelled = await withSession(async (session) => {
    const job = await Job.findOne({ _id: id, userId }, null, sessionOpts(session))
    if (!job) throw new ApiError("not_found", "Job not found", 404)
    if (!canStop(job.status as JobStatus)) {
      throw new ApiError("conflict", "Job cannot be stopped", 409)
    }
    const stopped = await cancelActiveJob(job, session, "stop", reason)
    await emit(job._id, "stopped", { reason }, session)
    return stopped
  })
  if (isStockPoolJob(cancelled)) await assignNextQueuedStockJob()
  return cancelled
}

async function cancelActiveJob(
  job: InstanceType<typeof Job>,
  session: ClientSession | null,
  event: "stop" | "lead_fail" | "eval_fail_cancel",
  reason: string
) {
  const planApproved = Boolean(job.planId && (await JobPlan.findById(job.planId, null, sessionOpts(session)))?.approvedAt)
  const workerPassed = await workerPassedCount(job._id, session)
  const evalSubmitted = Boolean(
    await Evaluation.findOne({ jobId: job._id }, null, sessionOpts(session))
  )
  job.status = transition(job.status as JobStatus, event)
  job.cancelReason = reason
  await job.save(sessionOpts(session))
  await settleJob(
    job._id,
    "partial",
    {
      planApproved,
      workerTasksPassedSchema: workerPassed,
      evalSubmitted,
    },
    session
  )
  await emit(job._id, "cancelled", { reason }, session)
  return job
}

export async function applyPlan(
  jobId: string,
  payload: {
    tasks: { type: string; acceptance?: string; listingSlug?: string }[]
    proposedListingSlugs: string[]
    estimatedCostCents: number
    questions: string[]
  }
) {
  const id = asObjectId(jobId)
  if (!id) throw new ApiError("not_found", "Job not found", 404)
  return withSession(async (session) => {
    const job = await Job.findById(id, null, sessionOpts(session))
    if (!job) throw new ApiError("not_found", "Job not found", 404)
    if (job.status !== "planning") {
      throw new ApiError("conflict", "Job is not planning", 409)
    }
    const taskSlugs = (payload.tasks ?? [])
      .map((row) => row.listingSlug)
      .filter((slug): slug is string => Boolean(slug))
    const slugs = [...new Set([...(payload.proposedListingSlugs ?? []), ...taskSlugs])]
    const listings = await Listing.find({ slug: { $in: slugs } }, null, sessionOpts(session))
    const tools = payload.tasks.map((row) => row.type)
    const allowedTask = new Set(["scope", "sources", "findings", "report", "plan", "evaluate"])
    const invalidTool = tools.some((type) => !allowedTask.has(type))
    const estimated = payload.estimatedCostCents || job.budgetCents
    const invalid =
      estimated > job.budgetCents || listings.length !== slugs.length || invalidTool

    const plan = await JobPlan.create(
      [
        {
          jobId: job._id,
          tasks: payload.tasks,
          proposedListingSlugs: slugs,
          estimatedCostCents: estimated,
          questions: payload.questions ?? [],
        },
      ],
      sessionOpts(session)
    )
    job.planId = plan[0]._id
    job.planSubmittedAt = new Date()
    job.status = transition("planning", "lead_ok")
    await job.save(sessionOpts(session))
    await Task.updateOne(
      { jobId: job._id, type: "plan" },
      { status: invalid ? "schema_failed" : "passed_schema" },
      sessionOpts(session)
    )
    if (invalid) {
      await emit(job._id, "plan_invalid", { estimatedCostCents: estimated }, session)
      return { ok: false as const, job }
    }
    await emit(job._id, "plan_submitted", {}, session)
    return { ok: true as const, job }
  })
}

export async function failLead(jobId: string, reason = "lead_failed") {
  const id = asObjectId(jobId)
  if (!id) throw new ApiError("not_found", "Job not found", 404)
  return withSession(async (session) => {
    const job = await Job.findById(id, null, sessionOpts(session))
    if (!job) throw new ApiError("not_found", "Job not found", 404)
    if (job.status !== "planning") {
      throw new ApiError("conflict", "Job is not planning", 409)
    }
    return cancelActiveJob(job, session, "lead_fail", reason)
  })
}

export async function approvePlan(userId: unknown, jobId: string) {
  const id = asObjectId(jobId)
  if (!id) throw new ApiError("not_found", "Job not found", 404)
  const defaultWorker =
    (await Listing.findOne({ slug: "worker-research", status: "live" })) ||
    (await ensureResearchHandoffListing())
  const defaultEval =
    (await Listing.findOne({ slug: "eval-research", status: "live" })) ||
    defaultWorker
  return withSession(async (session) => {
    const job = await Job.findOne({ _id: id, userId }, null, sessionOpts(session))
    if (!job) throw new ApiError("not_found", "Job not found", 404)
    if (job.status !== "plan_review") {
      throw new ApiError("conflict", "Plan is not awaiting approval", 409)
    }
    const plan = await JobPlan.findById(job.planId, null, sessionOpts(session))
    if (!plan) throw new ApiError("not_found", "Plan not found", 404)
    if (plan.estimatedCostCents > job.budgetCents) {
      throw new ApiError("budget", "Estimated cost exceeds budget", 400)
    }
    const planTasks = (plan.tasks ?? []) as {
      type?: string
      listingSlug?: string
    }[]
    const extraSlugs = planTasks
      .map((row) => row.listingSlug)
      .filter((slug): slug is string => Boolean(slug))
    const slugs = [...new Set([...(plan.proposedListingSlugs ?? []), ...extraSlugs])]
    const [proposed, ownerListing, liveWorkers, liveEvals] = await Promise.all([
      Listing.find(
        { slug: { $in: slugs }, status: "live" },
        null,
        sessionOpts(session)
      ),
      job.listingId
        ? Listing.findById(job.listingId, null, sessionOpts(session))
        : null,
      Listing.find({ kind: "worker", status: "live" }, null, sessionOpts(session)),
      Listing.find(
        { kind: "evaluator", status: "live" },
        null,
        sessionOpts(session)
      ),
    ])
    const { workersByType, evaluator } = staffJobListings({
      ownerListing,
      proposed,
      planTasks,
      liveWorkers,
      liveEvals,
      defaultWorker,
      defaultEval,
      need: needFromBrief(
        `${job.brief}\n${job.instructions ?? ""}`,
        String(ownerListing?.skills ?? "")
      ),
    })
    const workerOwners = [
      ...new Set(WORKER_STAGE_TYPES.map((type) => workersByType[type].ownerUserId)),
    ]
    if (!isIndependent(evaluator.ownerUserId, workerOwners)) {
      throw new ApiError("invalid", "Evaluator is not independent", 400)
    }
    plan.approvedAt = new Date()
    await plan.save(sessionOpts(session))
    job.status = transition("plan_review", "approve")
    await job.save(sessionOpts(session))

    for (const [index, type] of WORKER_STAGE_TYPES.entries()) {
      const worker = workersByType[type]
      const [task] = await Task.create(
        [
          {
            jobId: job._id,
            type,
            status: index === 0 ? "queued" : "created",
            listingId: worker._id,
            attempt: 1,
            timeoutMs: timeoutMs(type),
          },
        ],
        sessionOpts(session)
      )
      await Assignment.create(
        [
          {
            taskId: task._id,
            jobId: job._id,
            listingId: worker._id,
            ownerUserId: worker.ownerUserId,
            role: "worker",
          },
        ],
        sessionOpts(session)
      )
    }
    const [evalTask] = await Task.create(
      [
        {
          jobId: job._id,
          type: "evaluate",
          status: "created",
          listingId: evaluator._id,
          attempt: 1,
          timeoutMs: timeoutMs("evaluate"),
        },
      ],
      sessionOpts(session)
    )
    await Assignment.create(
      [
        {
          taskId: evalTask._id,
          jobId: job._id,
          listingId: evaluator._id,
          ownerUserId: evaluator.ownerUserId,
          role: "evaluator",
        },
      ],
      sessionOpts(session)
    )
    job.status = transition("staffing", "staffed")
    await job.save(sessionOpts(session))
    await emit(job._id, "plan_approved", {}, session)
    await emit(job._id, "task_queued", { type: "scope" }, session)
    return job
  })
}

function bumpSchemaFail(task: InstanceType<typeof Task>) {
  task.attempt += 1
  if (task.attempt > 2) {
    task.status = "schema_failed"
    return "terminal" as const
  }
  task.status = "queued"
  return "retry" as const
}

export async function submitWorkerTask(
  taskId: string,
  payload: Record<string, unknown>
) {
  const id = asObjectId(taskId)
  if (!id) throw new ApiError("not_found", "Task not found", 404)
  return withSession(async (session) => {
    const task = await Task.findById(id, null, sessionOpts(session))
    if (!task) throw new ApiError("not_found", "Task not found", 404)
    if (payload.jobId && hex(task.jobId) !== String(payload.jobId)) {
      throw new ApiError("invalid", "jobId does not match task", 400)
    }
    if (task.status !== "running") {
      throw new ApiError("conflict", "Task is not running", 409)
    }
    const job = await Job.findById(task.jobId, null, sessionOpts(session))
    if (!job) throw new ApiError("not_found", "Job not found", 404)

    const snapshots = await Snapshot.find({ jobId: job._id }, null, sessionOpts(session))
    const citableIds = new Set(
      snapshots
        .filter((row) => isCitableTool(row.toolName))
        .map((row) => hex(row._id))
    )
    const citationIds = (payload.citationIds as string[] | undefined) ?? []
    const citations = ((payload.citations as { snapshotId?: string }[]) ?? []) as {
      snapshotId?: string
    }[]

    if (task.type === "sources") {
      const cited = [...new Set(citations.map((row) => row.snapshotId).filter(Boolean))]
      if (cited.length < 5 || cited.some((id) => !citableIds.has(String(id)))) {
        const outcome = bumpSchemaFail(task)
        await task.save(sessionOpts(session))
        await emit(job._id, "schema_failed", { type: task.type }, session)
        if (outcome === "terminal") {
          await cancelActiveJob(job, session, "stop", "task_failed")
        }
        return task
      }
    }

    if (task.type === "report") {
      const markdown = String(payload.markdown ?? "")
      const distinct = [...new Set(citationIds)]
      if (
        markdown.trim().length < 400 ||
        distinct.length < 5 ||
        distinct.some((cid) => !citableIds.has(cid))
      ) {
        const outcome = bumpSchemaFail(task)
        await task.save(sessionOpts(session))
        await emit(job._id, "schema_failed", { type: task.type }, session)
        if (outcome === "terminal") {
          await cancelActiveJob(job, session, "stop", "task_failed")
        }
        return task
      }
    }

    await Artifact.create(
      [
        {
          taskId: task._id,
          jobId: job._id,
          round: job.revisionsUsed,
          attempt: task.attempt,
          markdown: String(payload.markdown ?? payload.notes ?? ""),
          payload,
          citations,
        },
      ],
      sessionOpts(session)
    )
    task.status = "passed_schema"
    await task.save(sessionOpts(session))
    await emit(job._id, "schema_passed", { type: task.type }, session)

    if (task.type === "scope") {
      await Task.updateOne({ jobId: job._id, type: "sources" }, { status: "queued" }, sessionOpts(session))
    }
    if (task.type === "sources") {
      await Task.updateOne({ jobId: job._id, type: "findings" }, { status: "queued" }, sessionOpts(session))
    }
    if (task.type === "findings") {
      await Task.updateOne({ jobId: job._id, type: "report" }, { status: "queued" }, sessionOpts(session))
    }
    if (task.type === "report") {
      job.status = transition("in_progress", "report_ok")
      await job.save(sessionOpts(session))
      await Task.updateOne(
        { jobId: job._id, type: "evaluate" },
        { status: "queued", attempt: 1 },
        sessionOpts(session)
      )
      await emit(job._id, "eval_started", {}, session)
    }
    return task
  })
}

export async function evaluateTask(
  taskId: string,
  modelOutput: {
    scores?: Scores | null
    pass?: boolean
    hardFails?: string[]
    comments?: string
  }
) {
  const id = asObjectId(taskId)
  if (!id) throw new ApiError("not_found", "Task not found", 404)
  const result = await withSession(async (session) => {
    const task = await Task.findById(id, null, sessionOpts(session))
    if (!task || task.type !== "evaluate") {
      throw new ApiError("not_found", "Task not found", 404)
    }
    if (task.status !== "running") {
      throw new ApiError("conflict", "Task is not running", 409)
    }
    const job = await Job.findById(task.jobId, null, sessionOpts(session))
    if (!job) throw new ApiError("not_found", "Job not found", 404)
    const reportTask = await Task.findOne(
      { jobId: job._id, type: "report" },
      null,
      sessionOpts(session)
    )
    const artifactQuery = Artifact.findOne({ taskId: reportTask?._id }).sort({
      round: -1,
      attempt: -1,
    })
    const artifact = session ? await artifactQuery.session(session) : await artifactQuery
    const snapshots = await Snapshot.find({ jobId: job._id }, null, sessionOpts(session))
    const payload = (artifact?.payload ?? {}) as {
      markdown?: string
      citationIds?: string[]
      citations?: never[]
    }
    const hardFails = computeHardFails(
      {
        markdown: String(payload.markdown ?? artifact?.markdown ?? ""),
        citationIds: payload.citationIds ?? [],
        citations: payload.citations,
      },
      { domain: job.domain },
      snapshots.map((row) => ({
        id: hex(row._id),
        url: row.url,
        text: row.text,
        toolName: row.toolName,
      }))
    )
    let scores: Scores | null = modelOutput.scores ?? null
    let pass = false
    if (hardFails.length > 0) {
      scores = null
      pass = false
    } else if (modelOutput.scores) {
      pass = computeVerdict(modelOutput.scores, hardFails).pass
    }

    await Evaluation.create(
      [
        {
          jobId: job._id,
          taskId: task._id,
          reportTaskId: reportTask!._id,
          round: job.revisionsUsed,
          evaluatorListingId: task.listingId,
          scores,
          pass,
          hardFails,
          comments: modelOutput.comments ?? "",
        },
      ],
      sessionOpts(session)
    )

    if (pass) {
      task.status = "passed"
      await task.save(sessionOpts(session))
      job.status = transition("evaluating", "eval_pass")
      job.deliveredAt = new Date()
      await job.save(sessionOpts(session))
      await emit(job._id, "eval_passed", {}, session)
      await emit(job._id, "delivered", {}, session)
      return job
    }

    task.status = "failed"
    await task.save(sessionOpts(session))
    if (job.revisionsUsed < job.caps.maxRevisions) {
      job.status = transition("evaluating", "eval_fail_revise")
      job.revisionsUsed += 1
      await job.save(sessionOpts(session))
      await Task.updateOne(
        { jobId: job._id, type: "report" },
        { status: "queued", attempt: 1 },
        sessionOpts(session)
      )
      job.status = transition("revision", "revision_queued")
      await job.save(sessionOpts(session))
      await emit(job._id, "eval_failed", { round: job.revisionsUsed - 1 }, session)
      await emit(job._id, "revision_started", { round: job.revisionsUsed }, session)
    } else {
      await emit(job._id, "eval_failed", {}, session)
      await cancelActiveJob(job, session, "eval_fail_cancel", "revisions_exhausted")
    }
    return job
  })
  if (result.status === "delivered") {
    try {
      await notifyJobDelivered(result._id)
    } catch (error) {
      console.error("deliver email failed:", error)
    }
  }
  return result
}

export async function acceptJob(userId: unknown, jobId: string) {
  const id = asObjectId(jobId)
  if (!id) throw new ApiError("not_found", "Job not found", 404)
  return withSession(async (session) => {
    const job = await Job.findOne({ _id: id, userId }, null, sessionOpts(session))
    if (!job) throw new ApiError("not_found", "Job not found", 404)
    return settleDeliveredJob(job, session)
  })
}

export async function settleDeliveredJob(
  job: InstanceType<typeof Job>,
  session: ClientSession | null = null
) {
  if (job.status !== "delivered") {
    throw new ApiError("conflict", "Job is not delivered", 409)
  }
  job.status = transition("delivered", "accept")
  await job.save(sessionOpts(session))
  const workerPassed = await workerPassedCount(job._id, session)
  await settleJob(
    job._id,
    "full",
    {
      planApproved: true,
      workerTasksPassedSchema: workerPassed,
      evalSubmitted: true,
    },
    session
  )
  await emit(job._id, "settled", {}, session)
  return job
}

export async function disputeJob(userId: unknown, jobId: string) {
  const id = asObjectId(jobId)
  if (!id) throw new ApiError("not_found", "Job not found", 404)
  const job = await Job.findOne({ _id: id, userId })
  if (!job) throw new ApiError("not_found", "Job not found", 404)
  if (job.status !== "delivered" || !job.deliveredAt) {
    throw new ApiError("conflict", "Job is not in the dispute window", 409)
  }
  const hours = job.evalPolicy.disputeHours
  if (Date.now() - job.deliveredAt.getTime() > hours * 3600_000) {
    throw new ApiError("conflict", "Dispute window closed", 409)
  }
  job.status = transition("delivered", "dispute")
  await job.save()
  await emit(job._id, "disputed", {})
  return job
}

export async function resolveDispute(
  userId: unknown,
  jobId: string,
  outcome: "cancelled" | "settled"
) {
  const id = asObjectId(jobId)
  if (!id) throw new ApiError("not_found", "Job not found", 404)
  return withSession(async (session) => {
    const job = await Job.findOne({ _id: id, userId }, null, sessionOpts(session))
    if (!job) throw new ApiError("not_found", "Job not found", 404)
    if (job.status !== "disputed") {
      throw new ApiError("conflict", "Job is not disputed", 409)
    }
    job.status = transition(
      "disputed",
      outcome === "cancelled" ? "resolve_cancelled" : "resolve_settled"
    )
    await job.save(sessionOpts(session))
    const workerPassed = await workerPassedCount(job._id, session)
    await settleJob(
      job._id,
      outcome === "settled" ? "full" : "partial",
      {
        planApproved: true,
        workerTasksPassedSchema: workerPassed,
        evalSubmitted: true,
      },
      session
    )
    await emit(job._id, outcome === "settled" ? "settled" : "cancelled", {}, session)
    return job
  })
}

export function jobToolPack(domain: string) {
  return toolsForDomain(domain)
}

export async function chargeCompute(jobId: unknown, cents: number) {
  if (cents <= 0) return
  await connect()
  const job = await Job.findByIdAndUpdate(
    jobId,
    { $inc: { computeSpentCents: cents } },
    { returnDocument: "after" }
  )
  if (!job) return
  if (job.computeSpentCents >= job.computeBudgetCents && canStop(job.status as JobStatus)) {
    await withSession(async (session) => {
      const fresh = await Job.findById(job._id, null, sessionOpts(session))
      if (!fresh || !canStop(fresh.status as JobStatus)) return
      await emit(fresh._id, "compute_exhausted", {}, session)
      await cancelActiveJob(fresh, session, "stop", "compute_exhausted")
    })
  }
}

export async function reapLocks(now = new Date()) {
  await connect()
  const cutoff = new Date(now.getTime() - 10 * 60 * 1000)
  const stale = await Task.find({ status: "running", lockedAt: { $lt: cutoff } })
  for (const task of stale) {
    task.status = "queued"
    task.lockedAt = undefined
    task.lockedBy = undefined
    await task.save()
    await emit(task.jobId, "lock_reaped", { type: task.type })
  }
  return stale.length
}

export async function settleDueJobs(now = new Date()) {
  await connect()
  const jobs = await Job.find({ status: "delivered", deliveredAt: { $ne: null } })
  let count = 0
  for (const job of jobs) {
    const hours = job.evalPolicy.disputeHours
    if (!job.deliveredAt) continue
    if (now.getTime() < job.deliveredAt.getTime() + hours * 3600_000) continue
    await withSession(async (session) => {
      const fresh = await Job.findById(job._id, null, sessionOpts(session))
      if (!fresh || fresh.status !== "delivered") return
      await settleDeliveredJob(fresh, session)
      count += 1
    })
  }
  return count
}

export async function expireIdlePlans(now = new Date()) {
  await connect()
  const cutoff = new Date(now.getTime() - 7 * 24 * 3600_000)
  const jobs = await Job.find({
    status: "plan_review",
    planSubmittedAt: { $lt: cutoff },
  })
  for (const job of jobs) {
    await withSession(async (session) => {
      const fresh = await Job.findById(job._id, null, sessionOpts(session))
      if (!fresh || fresh.status !== "plan_review") return
      await cancelActiveJob(fresh, session, "stop", "plan_expired")
    })
  }
  return jobs.length
}

async function predecessorOk(job: InstanceType<typeof Job>, task: InstanceType<typeof Task>) {
  if (task.type === "plan") return job.status === "planning"
  if (task.type === "scope") return job.status === "in_progress"
  if (task.type === "sources") {
    const scope = await Task.findOne({ jobId: job._id, type: "scope" })
    return job.status === "in_progress" && scope?.status === "passed_schema"
  }
  if (task.type === "findings") {
    const sources = await Task.findOne({ jobId: job._id, type: "sources" })
    return job.status === "in_progress" && sources?.status === "passed_schema"
  }
  if (task.type === "report") {
    const findings = await Task.findOne({ jobId: job._id, type: "findings" })
    return job.status === "in_progress" && findings?.status === "passed_schema"
  }
  if (task.type === "evaluate") {
    const report = await Task.findOne({ jobId: job._id, type: "report" })
    return job.status === "evaluating" && report?.status === "passed_schema"
  }
  return false
}

export async function claimQueuedTask(workerId: string) {
  await connect()
  const queued = await Task.find({ status: "queued" }).sort({ createdAt: 1 }).limit(50)
  for (const task of queued) {
    const job = await Job.findById(task.jobId)
    if (!job) continue
    if (!["planning", "in_progress", "evaluating"].includes(job.status)) continue
    if (!(await predecessorOk(job, task))) continue
    const claimed = await Task.findOneAndUpdate(
      { _id: task._id, status: "queued" },
      { status: "running", lockedAt: new Date(), lockedBy: workerId },
      { sort: { createdAt: 1 }, returnDocument: "after" }
    )
    if (claimed) {
      await emit(job._id, "task_claimed", { type: claimed.type })
      return { task: claimed, job, listing: await Listing.findById(claimed.listingId) }
    }
  }
  return null
}

export async function markTaskTimeout(taskId: unknown) {
  await connect()
  const task = await Task.findById(taskId)
  if (!task || task.status !== "running") return null
  task.attempt += 1
  task.status = task.attempt > 2 ? "timed_out" : "queued"
  task.lockedAt = undefined
  task.lockedBy = undefined
  await task.save()
  await emit(task.jobId, "task_timed_out", { type: task.type, attempt: task.attempt })
  if (task.attempt > 2) {
    const job = await Job.findById(task.jobId)
    if (job && canStop(job.status as JobStatus)) {
      const event = job.status === "planning" ? "lead_fail" : "stop"
      await withSession(async (session) => {
        const fresh = await Job.findById(job._id, null, sessionOpts(session))
        if (!fresh) return
        await cancelActiveJob(
          fresh,
          session,
          event,
          task.type === "plan" ? "lead_failed" : "task_failed"
        )
      })
    }
  }
  return task
}

export async function reportHardFails(jobId: unknown) {
  const job = await Job.findById(jobId)
  if (!job) return []
  const reportTask = await Task.findOne({ jobId: job._id, type: "report" })
  const artifact = await Artifact.findOne({ taskId: reportTask?._id }).sort({
    round: -1,
    attempt: -1,
  })
  const snapshots = await Snapshot.find({ jobId: job._id })
  const payload = (artifact?.payload ?? {}) as {
    markdown?: string
    citationIds?: string[]
    citations?: never[]
  }
  return computeHardFails(
    {
      markdown: String(payload.markdown ?? artifact?.markdown ?? ""),
      citationIds: payload.citationIds ?? [],
      citations: payload.citations,
    },
    { domain: job.domain },
    snapshots.map((row) => ({
      id: hex(row._id),
      url: row.url,
      text: row.text,
      toolName: row.toolName,
    }))
  )
}
