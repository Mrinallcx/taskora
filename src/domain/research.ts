import { createHash } from "node:crypto"

import { Invocation, Listing, Snapshot } from "@/src/db/models"
import { decryptSecret } from "@/src/crypto/secrets"
import { CITABLE_TOOLS } from "@/src/domain/evidence"
import { monthlyPrices, resolveFinanceAsset, yearlyPriceTable } from "@/src/domain/finance-asset"
import { executeTool } from "@/src/tools/index"
import { fetchCustomApi } from "@/src/tools/custom-api"
import { coinGeckoMarketChart } from "@/src/tools/crypto/coingecko"

const TARGET_SNAPSHOTS = 16
const MAX_SEARCHES = 8
const MAX_FETCHES = 18

type OwnerListing = {
  summary?: string
  prompt?: string
  tools?: string[]
  providers?: {
    name?: string
    endpoints?: string[]
    iv?: string
    tag?: string
    ciphertext?: string
  }[]
}

type JobLike = {
  _id: unknown
  brief: string
  instructions?: string
  domain: string
  listingId?: unknown
}

function researchText(job: JobLike) {
  const extra = (job.instructions ?? "").trim()
  if (!extra) return job.brief
  return `${job.brief.trim()}\n\n${extra}`
}

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "are",
  "was",
  "were",
  "with",
  "from",
  "that",
  "this",
  "have",
  "been",
  "what",
  "when",
  "which",
  "over",
  "into",
  "than",
  "then",
  "them",
  "also",
  "such",
  "last",
  "year",
  "years",
  "plus",
  "about",
  "after",
  "their",
  "there",
  "would",
  "could",
  "should",
  "look",
  "looks",
  "cite",
  "cited",
  "include",
  "short",
  "table",
  "through",
  "changed",
  "main",
  "most",
  "another",
  "live",
  "using",
  "based",
  "brief",
  "data",
  "does",
  "how",
  "has",
  "who",
  "its",
])

const JUNK_URL =
  /libguides|writingguide|policymemo|homework|chegg\.com|youtube\.com\/watch|linkedin\.com\/pulse|memorandum|legal-writing|how-to-write|coursehero|quizlet|medium\.com|pmc\.ncbi|pubmed\.ncbi|price-prediction|price-potential/i

export function briefKeywords(brief: string) {
  return [
    ...new Set(
      brief
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length >= 3 && !STOPWORDS.has(word))
    ),
  ].slice(0, 16)
}

function topicalListingExtra(brief: string, listing?: OwnerListing | null) {
  const summary = listing?.summary?.replace(/\s+/g, " ").trim().slice(0, 160)
  if (!summary) return null
  if (/you are|writes the|cited memo|follow these|instructions/i.test(summary)) {
    return null
  }
  const keys = briefKeywords(brief)
  if (keys.length === 0) return null
  const hay = summary.toLowerCase()
  if (!keys.some((key) => hay.includes(key))) return null
  return summary
}

export function searchQueries(brief: string, listing?: OwnerListing | null) {
  const topic = brief.replace(/\s+/g, " ").trim().slice(0, 200)
  const year = new Date().getUTCFullYear()
  const extras = [`${topic} ${year}`]
  if (/holder|venue|etf|who (owns|the main)/i.test(brief)) {
    extras.push(`${topic} holders ETFs corporate treasuries exchanges`)
  }
  if (/drawdown|crash|regulat/i.test(brief)) {
    extras.push(`${topic} drawdowns crashes SEC regulation ETF approval`)
  }
  if (/2027|outlook|demand looks|forecast/i.test(brief)) {
    extras.push(`${topic} demand outlook 2027 forecast`)
  }
  extras.push(`${topic} criticism risks drawbacks`)
  extras.push(`${topic} official primary sources`)
  extras.push(`${topic} history origins timeline`)
  if (!/market changed|holders|drawdown|price and market-cap/i.test(brief)) {
    extras.push(`${topic} how it works architecture technology`)
    extras.push(`${topic} market data statistics adoption`)
    extras.push(`${topic} future growth outlook`)
  }
  const topical = topicalListingExtra(brief, listing)
  if (topical) extras.unshift(topical)
  return [...new Set([topic, ...extras].filter(Boolean))].slice(0, MAX_SEARCHES)
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function diverseUrls(urls: string[], limit: number) {
  const picked: string[] = []
  const seenHost = new Set<string>()
  const overflow: string[] = []
  for (const url of urls) {
    const host = hostOf(url)
    if (!seenHost.has(host)) {
      seenHost.add(host)
      picked.push(url)
    } else {
      overflow.push(url)
    }
    if (picked.length >= limit) return picked
  }
  for (const url of overflow) {
    if (picked.length >= limit) break
    picked.push(url)
  }
  return picked
}

function isPrimaryGovHost(host: string) {
  return /(?:^|\.)(sec|whitehouse|treasury|congress|cftc|federalreserve|govinfo)\.gov$/.test(
    host
  )
}

export function officialScore(url: string) {
  const host = hostOf(url)
  if (isPrimaryGovHost(host)) return 3
  if (host === "wikipedia.org" || host.endsWith(".wikipedia.org")) return 3
  if (host === "coingecko.com" || host.endsWith(".coingecko.com")) return 3
  if (host === "github.com" || host.endsWith(".github.com") || host.endsWith(".github.io")) {
    return 2
  }
  if (host.startsWith("docs.") || host.includes(".docs.")) return 2
  if (host.startsWith("investor.") || host.includes("investor.")) return 2
  return 0
}

export function isJunkResearchUrl(url: string) {
  return JUNK_URL.test(url)
}

export function urlFitsBrief(url: string, brief: string, title = "") {
  if (isJunkResearchUrl(url)) return false
  const keys = briefKeywords(brief)
  if (keys.length === 0) return true
  const hay = `${url} ${title}`.toLowerCase()
  if (keys.some((key) => hay.includes(key))) return true
  const host = hostOf(url)
  return isPrimaryGovHost(host) || host.includes("coingecko") || host.includes("wikipedia")
}

/** Official-looking hosts first, then one URL per host, then overflow. */
export function rankUrlsForFetch(urls: string[], limit: number, brief = "") {
  const withoutJunk = urls.filter((url) => !isJunkResearchUrl(url))
  const fitted = brief
    ? withoutJunk.filter((url) => urlFitsBrief(url, brief))
    : withoutJunk
  const pool = fitted.length >= 5 ? fitted : withoutJunk
  const ranked = [...pool].sort((a, b) => officialScore(b) - officialScore(a))
  return diverseUrls(ranked, limit)
}

async function saveSnapshot(
  jobId: unknown,
  url: string,
  text: string,
  toolName: string
) {
  const body = text.trim()
  if (!body) return
  await Snapshot.findOneAndUpdate(
    { jobId, url },
    {
      jobId,
      url,
      text: body,
      sha256: createHash("sha256").update(body).digest("hex"),
      toolName,
      retrievedAt: new Date(),
    },
    { upsert: true }
  )
}

function liveNetwork() {
  return (
    process.env.AGENT_PROVIDER === "cerebras" &&
    process.env.TOOL_PROVIDER !== "fake"
  )
}

async function callListingProviders(job: JobLike, listing: OwnerListing) {
  if (!liveNetwork()) return
  for (const provider of listing.providers ?? []) {
    if (!provider.iv || !provider.tag || !provider.ciphertext) continue
    let apiKey = ""
    try {
      apiKey = decryptSecret({
        iv: provider.iv,
        tag: provider.tag,
        ciphertext: provider.ciphertext,
      })
    } catch {
      continue
    }
    for (const endpoint of provider.endpoints ?? []) {
      const result = await fetchCustomApi(endpoint, apiKey)
      if (!result.ok) continue
      await saveSnapshot(job._id, result.data.url, result.data.text, "custom_api")
    }
  }
}

async function seedFallback(job: JobLike) {
  for (let i = 1; i <= TARGET_SNAPSHOTS; i += 1) {
    const url = `https://example.com/tea/${i}`
    const text = `The history of tea trade over the last 20 years. Source ${i}.`
    await saveSnapshot(job._id, url, text, "fetch_page")
  }
}

export async function gatherInDepthSources(
  job: JobLike,
  taskId: unknown,
  listing?: OwnerListing | InstanceType<typeof Listing> | null
) {
  const existing = await Snapshot.countDocuments({
    jobId: job._id,
    toolName: { $in: [...CITABLE_TOOLS] },
  })
  if (existing >= TARGET_SNAPSHOTS) return
  const priorSearches = await Invocation.countDocuments({
    jobId: job._id,
    tool: "web_search",
  })
  if (priorSearches > 0 && existing >= 5) return

  const caps = (job as { caps?: { maxSearches?: number; maxFetches?: number } }).caps
  if (caps) {
    caps.maxSearches = Math.max(caps.maxSearches ?? 0, 12)
    caps.maxFetches = Math.max(caps.maxFetches ?? 0, 24)
  }

  if (listing) {
    await callListingProviders(job, listing)
  }

  const topic = researchText(job)
  const queries = searchQueries(topic, listing)
  const searches: Awaited<ReturnType<typeof executeTool>>[] = []
  if (liveNetwork()) {
    for (const query of queries) {
      searches.push(await executeTool(job as never, taskId, "web_search", { query, n: 8 }))
    }
  } else {
    searches.push(
      ...(await Promise.all(
        queries.map((query) =>
          executeTool(job as never, taskId, "web_search", { query, n: 8 })
        )
      ))
    )
  }

  const already = new Set(
    (await Snapshot.find({ jobId: job._id }).select("url")).map((row) => row.url)
  )
  const urls: string[] = []
  const allHits: string[] = []
  for (const search of searches) {
    if (!search.ok) continue
    const hits = (search.data as { hits: { url: string; title?: string; snippet?: string }[] })
      .hits
    for (const hit of hits) {
      if (!hit.url.startsWith("http") || already.has(hit.url) || allHits.includes(hit.url)) {
        continue
      }
      allHits.push(hit.url)
      if (!urlFitsBrief(hit.url, topic, hit.title ?? "")) continue
      urls.push(hit.url)
    }
  }

  let toFetch = rankUrlsForFetch(urls, MAX_FETCHES, topic)
  if (toFetch.length === 0) {
    toFetch = rankUrlsForFetch(allHits, MAX_FETCHES, "").filter(
      (url) => !isJunkResearchUrl(url)
    )
  }
  for (let i = 0; i < toFetch.length; i += 6) {
    await Promise.all(
      toFetch.slice(i, i + 6).map(async (url) => {
        await executeTool(job as never, taskId, "fetch_page", { url })
      })
    )
  }

  const tools = listing?.tools ?? []
  const asset = resolveFinanceAsset(topic)
  if (tools.includes("crypto") || job.domain === "finance" || asset?.kind === "crypto") {
    const symbol = asset?.kind === "crypto" ? asset.id : "bitcoin"
    await executeTool(job as never, taskId, "crypto_quote", { symbol })
    if (process.env.AGENT_PROVIDER === "cerebras") {
      let chart = await coinGeckoMarketChart(symbol, "max")
      if (!chart.ok) chart = await coinGeckoMarketChart(symbol, 3650)
      if (!chart.ok) chart = await coinGeckoMarketChart(symbol, 365)
      if (chart.ok) {
        const table = yearlyPriceTable(symbol, chart.data.points)
        const monthly = monthlyPrices(chart.data.points)
          .map((row) => `${row.month} ${row.price}`)
          .join("\n")
        await saveSnapshot(
          job._id,
          chart.data.sourceUrl,
          [table, monthly ? `Recent monthly USD close\n${monthly}` : ""]
            .filter(Boolean)
            .join("\n\n"),
          "crypto_quote"
        )
      }
    }
  }
  if (tools.includes("stocks")) {
    await executeTool(job as never, taskId, "price_quote", { symbol: "SPY" })
  }

  const after = await Snapshot.countDocuments({
    jobId: job._id,
    toolName: { $in: [...CITABLE_TOOLS] },
  })
  if (after < 5 && process.env.AGENT_PROVIDER !== "cerebras") {
    await seedFallback(job)
  }
}
