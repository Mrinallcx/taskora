import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createHmac, timingSafeEqual } from "node:crypto"

import { Artifact, Event, Job, Listing, Task } from "@/src/db/models"
import { connect } from "@/src/db/connect"
import { ApiError } from "@/src/domain/errors"
import { timeoutMs } from "@/src/domain/timeouts"
import { asObjectId, hex } from "@/src/lib/ids"

const DISPATCHED = "grok_bot_dispatched"
const CALLBACK_FILE = ".grok-callback-base"

export function grokBotTestEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    !process.env.VITEST &&
    Boolean(process.env.GROK_BOT_WEBHOOK_URL?.trim())
  )
}

function fileCallbackBase() {
  try {
    return readFileSync(join(process.cwd(), CALLBACK_FILE), "utf8").trim()
  } catch {
    return ""
  }
}

function callbackSecret() {
  return process.env.WORKER_SECRET || "dev"
}

export function grokCallbackToken(jobId: string) {
  return createHmac("sha256", callbackSecret())
    .update(`grok-complete:${jobId}`)
    .digest("hex")
}

export function grokCallbackTokenOk(jobId: string, token: string) {
  if (!token) return false
  const expected = grokCallbackToken(jobId)
  const left = Buffer.from(token)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function grokCallbackUrl(jobId: string, base?: string) {
  const origin = (
    base ||
    process.env.GROK_BOT_CALLBACK_BASE ||
    fileCallbackBase() ||
    process.env.APP_BASE_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "")
  return `${origin}/api/jobs/${jobId}/grok-complete?token=${grokCallbackToken(jobId)}`
}

function extractMarkdown(body: unknown) {
  if (typeof body === "string" && body.trim()) return body.trim()
  if (!body || typeof body !== "object" || Array.isArray(body)) return ""
  const row = body as Record<string, unknown>
  for (const key of ["markdown", "memo", "output", "text", "result", "content"]) {
    if (typeof row[key] === "string" && row[key].trim()) return String(row[key]).trim()
  }
  if (row.message && typeof row.message === "object") {
    const message = row.message as Record<string, unknown>
    if (typeof message.content === "string" && message.content.trim()) {
      return message.content.trim()
    }
  }
  return ""
}

async function ensureResearchHandoffListing() {
  const existing =
    (await Listing.findOne({ slug: "research-handoff" })) ||
    (await Listing.findOne({ slug: "worker-research", status: "live" }))
  if (existing) {
    if (existing.status !== "live") {
      existing.status = "live"
      await existing.save()
    }
    return existing
  }
  const [created] = await Listing.create([
    {
      slug: "research-handoff",
      kind: "worker",
      ownerUserId: "platform",
      vertical: "research",
      priceCents: 2000,
      runtime: "hosted_prompt",
      status: "live",
      name: "Research",
      summary: "Internal research handoff. Not listed on the marketplace.",
      skills: "research, citations",
      isPublic: false,
      tools: ["web_search", "fetch_page"],
    },
  ])
  return created
}

async function workerListing() {
  return ensureResearchHandoffListing()
}

export { ensureResearchHandoffListing }

export function researchPrompt(job: { brief: string; instructions?: string }) {
  const extra = (job.instructions ?? "").trim()
  if (!extra) return job.brief
  return `${job.brief.trim()}\n\nResearch instructions:\n${extra}`
}

export async function pingGrokBot(input: {
  jobId: string
  brief: string
  webhookUrl?: string
  webhookKey?: string
  callbackBase?: string
}) {
  const webhookUrl = (input.webhookUrl || process.env.GROK_BOT_WEBHOOK_URL || "").trim()
  const webhookKey = (input.webhookKey || process.env.GROK_BOT_WEBHOOK_KEY || "").trim()
  if (!webhookUrl) {
    return { pinged: false as const, reason: "no_webhook" as const, status: 0 }
  }
  const callbackUrl = grokCallbackUrl(input.jobId, input.callbackBase)
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (webhookKey) {
    headers.Authorization = `Bearer ${webhookKey}`
    headers["X-Automation-Key"] = webhookKey
  }
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      event: "taskora.job",
      jobId: input.jobId,
      brief: input.brief,
      callbackUrl,
      instruction:
        "Do the entire brief using live sources where asked. Follow any research instructions in the brief. Write the memo in markdown. Then HTTP POST JSON { \"markdown\": \"<full memo>\" } to callbackUrl. Do not wait for the user. Do not include secrets.",
    }),
  })
  const text = await response.text()
  return {
    pinged: response.ok,
    reason: response.ok ? ("ok" as const) : ("webhook_http" as const),
    status: response.status,
    body: text.slice(0, 400),
  }
}

export async function handoffJobToGrokBot(
  job: InstanceType<typeof Job>,
  opts: { webhookUrl?: string; webhookKey?: string; callbackBase?: string } = {}
) {
  await connect()
  const listing =
    (job.listingId ? await Listing.findById(job.listingId) : null) ||
    (await workerListing())
  if (!listing) {
    throw new ApiError("not_found", "No listing for Grok Bot handoff", 404)
  }
  let task = await Task.findOne({ jobId: job._id, type: "report" })
  if (!task) {
    const [created] = await Task.create([
      {
        jobId: job._id,
        type: "report",
        status: "created",
        listingId: listing._id,
        attempt: 1,
        timeoutMs: timeoutMs("report"),
      },
    ])
    task = created
  }
  const already = await Event.findOne({ jobId: job._id, type: DISPATCHED })
  if (!already) {
    await Event.create({
      jobId: job._id,
      type: DISPATCHED,
      payload: { taskId: hex(task._id) },
      at: new Date(),
    })
  }
  const ping = await pingGrokBot({
    jobId: hex(job._id),
    brief: researchPrompt(job),
    webhookUrl: opts.webhookUrl,
    webhookKey: opts.webhookKey,
    callbackBase: opts.callbackBase,
  })
  await Event.create({
    jobId: job._id,
    type: ping.pinged ? "grok_bot_pinged" : "grok_bot_ping_failed",
    payload: { reason: ping.reason, status: ping.status },
    at: new Date(),
  })
  return { task, ping, callbackUrl: grokCallbackUrl(hex(job._id), opts.callbackBase) }
}

export async function createGrokBotJob(
  user: { _id: unknown; clerkUserId: string },
  body: {
    brief?: string
    instructions?: string
    webhookUrl?: string
    webhookKey?: string
    callbackBase?: string
  } = {}
) {
  await connect()
  const brief =
    body.brief?.trim() ||
    "In 6 bullet points, what is a sourced research desk versus a chatbot? Keep it short."
  const instructions = (body.instructions ?? "").trim()
  const listing = await workerListing()
  if (!listing) {
    throw new ApiError("not_found", "No live listing to attach this test job", 404)
  }
  const job = await Job.create({
    userId: user._id,
    clerkUserId: user.clerkUserId,
    domain: "general",
    brief,
    instructions,
    status: "in_progress",
    budgetCents: 2000,
    computeBudgetCents: 50,
    listingId: listing._id,
  })
  const handed = await handoffJobToGrokBot(job, body)
  return {
    job,
    task: handed.task,
    ping: handed.ping,
    callbackUrl: handed.callbackUrl,
  }
}

export async function applyGrokBotMemo(jobId: string, body: unknown) {
  await connect()
  const id = asObjectId(jobId)
  if (!id) throw new ApiError("not_found", "Job not found", 404)
  const job = await Job.findById(id)
  if (!job) throw new ApiError("not_found", "Job not found", 404)
  const dispatched = await Event.findOne({ jobId: job._id, type: DISPATCHED })
  if (!dispatched) {
    throw new ApiError("forbidden", "This job is not waiting on Grok Bot", 403)
  }
  const markdown = extractMarkdown(body)
  if (!markdown) throw new ApiError("invalid", "markdown is required")
  const dispatchedPayload = (dispatched.payload ?? {}) as { taskId?: string }
  const task =
    (await Task.findOne({ jobId: job._id, type: "report" })) ||
    (await Task.findById(asObjectId(String(dispatchedPayload.taskId ?? ""))))
  if (!task) throw new ApiError("not_found", "Report task missing", 404)
  await Artifact.findOneAndUpdate(
    { taskId: task._id, jobId: job._id },
    {
      taskId: task._id,
      jobId: job._id,
      round: 0,
      attempt: 1,
      markdown,
      payload: { markdown, source: "grok_bot" },
      citations: [],
    },
    { upsert: true, returnDocument: "after" }
  )
  task.status = "passed_schema"
  await task.save()
  job.status = "delivered"
  job.deliveredAt = new Date()
  await job.save()
  await Event.create({
    jobId: job._id,
    type: "grok_bot_completed",
    payload: { chars: markdown.length },
    at: new Date(),
  })
  return { job, markdown }
}
