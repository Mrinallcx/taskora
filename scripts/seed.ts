import { connect } from "../src/db/connect"
import { Listing } from "../src/db/models"
import { loadLocalEnv } from "../src/lib/load-env"

const SEED = [
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
    tools: [],
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
    tools: [],
  },
] as const

export async function seedListings() {
  await connect()
  for (const row of SEED) {
    await Listing.findOneAndUpdate({ slug: row.slug }, { $set: row }, { upsert: true })
  }
}

const isMain = process.argv[1]?.includes("seed")
if (isMain) {
  loadLocalEnv()
  seedListings()
    .then(() => {
      console.log("Seeded lead-research, worker-research, eval-research")
      process.exit(0)
    })
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
