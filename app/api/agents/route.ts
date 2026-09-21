import { NextResponse } from "next/server"
import { z } from "zod"

import { connect } from "@/src/db/connect"
import { Listing, Merchant } from "@/src/db/models"
import { encryptSecret } from "@/src/crypto/secrets"
import { ApiError } from "@/src/domain/errors"
import { jsonError } from "@/src/lib/http"
import { getSessionUser } from "@/src/lib/auth"
import { hex } from "@/src/lib/ids"
import { startListingJob } from "@/src/domain/listing-jobs"
import { parseClock } from "@/src/domain/schedule"
import { ownedAppIds } from "@/src/domain/user-apps"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const createAgentSchema = z.object({
  name: z.string().trim().min(1).max(80),
  role: z.enum(["lead", "worker", "evaluator"]),
  vertical: z.enum(["research"]),
  summary: z.string().trim().max(2000).default(""),
  priceCents: z.coerce.number().int().min(0).max(1_000_000).default(0),
  skills: z.string().trim().max(500).default(""),
  prompt: z.string().trim().max(20_000).default(""),
  tools: z.array(z.enum(["web_search", "fetch_page", "stocks", "crypto"])).default([]),
  isPublic: z.boolean().default(false),
  underMerchant: z.boolean().default(false),
  runImmediately: z.boolean().default(false),
  scheduleCadence: z.enum(["off", "daily", "weekly", "monthly"]).default("off"),
  scheduleTime: z.string().min(4).max(8).default("09:00"),
  scheduleWeekday: z.coerce.number().int().min(0).max(6).default(1),
  scheduleMonthDay: z.coerce.number().int().min(1).max(28).default(1),
  scheduleTimezone: z.string().trim().max(80).default("UTC"),
  emailOnDeliver: z.boolean().default(false),
  notifyEmail: z.string().trim().email().or(z.literal("")).default(""),
  defaultBrief: z.string().trim().max(8000).default(""),
  useUserSearch: z.boolean().default(false),
  useUserPrices: z.boolean().default(false),
  useAppIds: z.array(z.string().trim().min(1).max(40)).max(40).default([]),
  providers: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        apiKey: z.string().min(1).max(500),
        endpoints: z.array(z.string().url()).min(1).max(20),
      })
    )
    .max(20)
    .default([]),
})
.superRefine((data, ctx) => {
  if (data.role === "evaluator") {
    if (!data.prompt.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Add a rubric for this evaluator.",
        path: ["prompt"],
      })
    }
    return
  }
  if ((data.runImmediately || data.scheduleCadence !== "off") && !data.defaultBrief) {
    ctx.addIssue({
      code: "custom",
      message: "Add a brief to run this agent.",
      path: ["defaultBrief"],
    })
  }
})

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
  return `${base || "agent"}-${Math.random().toString(36).slice(2, 8)}`
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request)
    let json: unknown
    try {
      json = await request.json()
    } catch {
      throw new ApiError("invalid", "Invalid JSON")
    }
    const parsed = createAgentSchema.safeParse(json)
    if (!parsed.success) {
      throw new ApiError("invalid", "Check the listing fields and try again.")
    }
    const data = parsed.data
    const clock = parseClock(data.scheduleTime)
    const scheduleTime = `${String(clock.hours).padStart(2, "0")}:${String(clock.minutes).padStart(2, "0")}`
    const notifyEmail = data.notifyEmail || user.email || ""
    if (data.emailOnDeliver && !notifyEmail) {
      throw new ApiError("invalid", "Add an email for delivery.")
    }
    await connect()
    const isEvaluator = data.role === "evaluator"
    const merchant = isEvaluator
      ? null
      : await Merchant.findOne({ ownerUserId: hex(user._id) }).select("_id")
    const underMerchant = Boolean(merchant) && data.underMerchant
    const listing = await Listing.create({
      slug: slugify(data.name),
      kind: data.role,
      ownerUserId: hex(user._id),
      vertical: data.vertical,
      priceCents: data.priceCents,
      runtime: "hosted_prompt",
      status: "live",
      name: data.name,
      summary: data.summary,
      skills: data.skills,
      prompt: data.prompt,
      tools: isEvaluator ? [] : data.tools,
      isPublic: data.isPublic,
      underMerchant,
      defaultBrief: isEvaluator ? "" : data.defaultBrief,
      runImmediately: isEvaluator ? false : data.runImmediately,
      scheduleCadence: isEvaluator ? "off" : data.scheduleCadence,
      scheduleTime,
      scheduleWeekday: data.scheduleWeekday,
      scheduleMonthDay: data.scheduleMonthDay,
      scheduleTimezone: data.scheduleTimezone,
      lastScheduledAt: !isEvaluator && data.runImmediately ? new Date() : undefined,
      emailOnDeliver: isEvaluator ? false : data.emailOnDeliver,
      notifyEmail: isEvaluator ? "" : notifyEmail,
      useUserSearch: isEvaluator ? false : data.useUserSearch,
      useUserPrices: isEvaluator ? false : data.useUserPrices,
      useAppIds: isEvaluator ? [] : await ownedAppIds(user._id, data.useAppIds),
      providers: isEvaluator
        ? []
        : data.providers.map((provider) => ({
            name: provider.name,
            endpoints: provider.endpoints,
            last4: provider.apiKey.slice(-4),
            ...encryptSecret(provider.apiKey),
          })),
    })
    let jobId: string | null = null
    let warning: string | null = null
    if (!isEvaluator && data.runImmediately) {
      try {
        const job = await startListingJob(user, listing)
        jobId = hex(job._id)
      } catch (error) {
        warning =
          error instanceof ApiError
            ? error.message
            : "Listing published, but the first run could not start."
      }
    }
    return NextResponse.json({ id: String(listing._id), jobId, warning })
  } catch (error) {
    return jsonError(error)
  }
}
