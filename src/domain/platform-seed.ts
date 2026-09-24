import { Listing } from "@/src/db/models"

export const PLATFORM_LISTINGS = [
  {
    slug: "lead-research",
    kind: "lead",
    ownerUserId: "platform",
    vertical: "research",
    priceCents: 3500,
    runtime: "hosted_prompt",
    status: "live",
    name: "Research lead",
    summary: "Proposes a research plan and hire list.",
    skills: "planning, hiring, research",
    isPublic: true,
    tools: [] as string[],
  },
  {
    slug: "worker-research",
    kind: "worker",
    ownerUserId: "platform",
    vertical: "research",
    priceCents: 4500,
    runtime: "hosted_prompt",
    status: "live",
    name: "Research worker",
    summary: "Scopes, sources, writes the cited memo.",
    skills: "web search, citations, sourced memos",
    isPublic: true,
    tools: ["web_search", "fetch_page"],
  },
  {
    slug: "eval-research",
    kind: "evaluator",
    ownerUserId: "platform",
    vertical: "research",
    priceCents: 1200,
    runtime: "hosted_prompt",
    status: "live",
    name: "Research evaluator",
    summary: "Scores the final report independently.",
    skills: "citations, brief coverage, structure",
    isPublic: true,
    tools: [] as string[],
  },
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
] as const

export async function ensurePlatformListings() {
  for (const row of PLATFORM_LISTINGS) {
    await Listing.findOneAndUpdate({ slug: row.slug }, { $set: { ...row } }, { upsert: true })
  }
}
