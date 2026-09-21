import { createHash } from "node:crypto"

import { Credential, Invocation, Job, Snapshot } from "@/src/db/models"
import { toolAllowed } from "@/src/domain/allowlists"
import { toolCents } from "@/src/domain/compute"
import { chargeCompute } from "@/src/domain/jobs"
import { decryptSecret } from "@/src/crypto/secrets"
import { fetchPage } from "@/src/tools/fetch-page"
import { fakePaperGet, fakePaperSearch } from "@/src/tools/papers/fake"
import { openAlexSearch } from "@/src/tools/papers/openalex"
import { alphaVantageQuote } from "@/src/tools/prices/alphavantage"
import { fakePriceQuote } from "@/src/tools/prices/fake"
import { edgarSearch } from "@/src/tools/sec/edgar"
import { fakeSecFiling, fakeSecSearch } from "@/src/tools/sec/fake"
import { fakeSearch } from "@/src/tools/search/fake"
import { firecrawlScrape, firecrawlSearch } from "@/src/tools/search/firecrawl"
import { serperSearch } from "@/src/tools/search/serper"
import { coinGeckoQuote } from "@/src/tools/crypto/coingecko"
import type { ToolResult } from "@/src/tools/types"

const SEARCH_TOOLS = new Set(["web_search"])
const FETCH_TOOLS = new Set(["fetch_page"])
const DOMAIN_TOOLS = new Set([
  "sec_search",
  "sec_filing",
  "price_quote",
  "crypto_quote",
  "paper_search",
  "paper_get",
])

function liveFirecrawl() {
  return Boolean(process.env.FIRECRAWL_API_KEY) && process.env.TOOL_PROVIDER !== "fake"
}

function liveCrypto() {
  return Boolean(process.env.COINGECKO_API_KEY) && process.env.TOOL_PROVIDER !== "fake"
}

async function countTool(jobId: unknown, tool: string) {
  return Invocation.countDocuments({ jobId, tool })
}

async function resolveSecret(
  job: InstanceType<typeof Job>,
  kind: "web_search" | "prices"
): Promise<{ key: string; source: "platform" | "user" | "fallback" } | ToolResult<never>> {
  const useUser = kind === "web_search" ? job.useUserSearch : job.useUserPrices
  const envKey = kind === "web_search" ? process.env.SEARCH_API_KEY : process.env.PRICES_API_KEY
  if (useUser) {
    const row = await Credential.findOne({ userId: job.userId, kind })
    if (!row) {
      if (job.fallbackToPlatform && envKey) {
        return { key: envKey, source: "fallback" }
      }
      return { ok: false, code: "credential_error", message: "User credential missing" }
    }
    try {
      return { key: decryptSecret(row), source: "user" }
    } catch {
      return { ok: false, code: "credential_error", message: "Could not decrypt credential" }
    }
  }
  if (!envKey && process.env.AGENT_PROVIDER !== "fake") {
    return { ok: false, code: "credential_error", message: "Platform key missing" }
  }
  return { key: envKey ?? "fake", source: "platform" }
}

async function record(
  jobId: unknown,
  taskId: unknown,
  tool: string,
  args: unknown,
  result: unknown,
  source: "platform" | "user" | "fallback"
) {
  const cost = toolCents(tool)
  await Invocation.create({
    jobId,
    taskId,
    tool,
    argsHash: createHash("sha256").update(JSON.stringify(args)).digest("hex"),
    resultHash: createHash("sha256").update(JSON.stringify(result)).digest("hex"),
    tokens: 0,
    costCents: cost,
    credentialSource: source,
  })
  await chargeCompute(jobId, cost)
}

export async function executeTool(
  job: InstanceType<typeof Job>,
  taskId: unknown,
  tool: string,
  args: Record<string, unknown>
): Promise<ToolResult<unknown>> {
  if (!toolAllowed(job.domain, tool)) {
    const result = {
      ok: false as const,
      code: "not_allowed_for_domain" as const,
      message: `${tool} is not allowed for ${job.domain}`,
    }
    await record(job._id, taskId, tool, args, result, "platform")
    return result
  }

  const searches = await countTool(job._id, "web_search")
  const fetches = await countTool(job._id, "fetch_page")
  const domainCalls = await Invocation.countDocuments({
    jobId: job._id,
    tool: { $in: [...DOMAIN_TOOLS] },
  })
  if (SEARCH_TOOLS.has(tool) && searches >= job.caps.maxSearches) {
    const result = { ok: false as const, code: "cap_exceeded" as const, message: "maxSearches" }
    await record(job._id, taskId, tool, args, result, "platform")
    return result
  }
  if (FETCH_TOOLS.has(tool) && fetches >= job.caps.maxFetches) {
    const result = { ok: false as const, code: "cap_exceeded" as const, message: "maxFetches" }
    await record(job._id, taskId, tool, args, result, "platform")
    return result
  }
  if (DOMAIN_TOOLS.has(tool) && domainCalls >= job.caps.maxDomainCalls) {
    const result = { ok: false as const, code: "cap_exceeded" as const, message: "maxDomainCalls" }
    await record(job._id, taskId, tool, args, result, "platform")
    return result
  }

  const fakeModel = process.env.AGENT_PROVIDER !== "cerebras"
  let result: ToolResult<unknown>
  let source: "platform" | "user" | "fallback" = "platform"

  if (tool === "web_search") {
    if (fakeModel) {
      result = await fakeSearch(String(args.query ?? ""))
    } else if (job.useUserSearch) {
      const secret = await resolveSecret(job, "web_search")
      if ("ok" in secret) {
        await record(job._id, taskId, tool, args, secret, "platform")
        return secret
      }
      source = secret.source
      result = await serperSearch(String(args.query ?? ""), secret.key, Number(args.n ?? 5))
    } else if (liveFirecrawl()) {
      result = await firecrawlSearch(String(args.query ?? ""), Number(args.n ?? 5))
    } else {
      const secret = await resolveSecret(job, "web_search")
      if ("ok" in secret) {
        await record(job._id, taskId, tool, args, secret, "platform")
        return secret
      }
      source = secret.source
      result = await serperSearch(String(args.query ?? ""), secret.key, Number(args.n ?? 5))
    }
  } else if (tool === "fetch_page") {
    const url = String(args.url ?? "")
    if (fakeModel) {
      const text = `SOURCE_DOCUMENT extracted from ${url}. The history of tea trade. tea`
      const sha256 = createHash("sha256").update(text).digest("hex")
      const snap = await Snapshot.findOneAndUpdate(
        { jobId: job._id, url },
        {
          jobId: job._id,
          url,
          text,
          sha256,
          toolName: "fetch_page",
          retrievedAt: new Date(),
        },
        { upsert: true, returnDocument: "after" }
      )
      result = {
        ok: true,
        data: { snapshotId: String(snap._id), url, text, sha256 },
      }
    } else if (liveFirecrawl()) {
      const scraped = await firecrawlScrape(url)
      if (!scraped.ok) {
        result = scraped
      } else {
        const text = scraped.data.text
        const sha256 = createHash("sha256").update(text).digest("hex")
        const snap = await Snapshot.findOneAndUpdate(
          { jobId: job._id, url: scraped.data.url },
          {
            jobId: job._id,
            url: scraped.data.url,
            text,
            sha256,
            toolName: "fetch_page",
            retrievedAt: new Date(),
          },
          { upsert: true, returnDocument: "after" }
        )
        result = {
          ok: true,
          data: { snapshotId: String(snap._id), url: scraped.data.url, text, sha256 },
        }
      }
    } else {
      result = await fetchPage(job._id, url)
    }
  } else if (tool === "sec_search") {
    result = fakeModel ? await fakeSecSearch() : await edgarSearch(String(args.query ?? ""))
  } else if (tool === "sec_filing") {
    result = fakeModel
      ? await fakeSecFiling(String(args.accession ?? ""))
      : await fakeSecFiling(String(args.accession ?? ""))
    if (result.ok) {
      const data = result.data as { url: string; text: string }
      const snap = await Snapshot.findOneAndUpdate(
        { jobId: job._id, url: data.url },
        {
          jobId: job._id,
          url: data.url,
          text: data.text,
          sha256: createHash("sha256").update(data.text).digest("hex"),
          toolName: "sec_filing",
          retrievedAt: new Date(),
        },
        { upsert: true, returnDocument: "after" }
      )
      result = { ok: true, data: { ...data, snapshotId: String(snap._id) } }
    }
  } else if (tool === "price_quote") {
    const secret = await resolveSecret(job, "prices")
    if ("ok" in secret) {
      await record(job._id, taskId, tool, args, secret, "platform")
      return secret
    }
    source = secret.source
    result = fakeModel
      ? await fakePriceQuote(String(args.symbol ?? "AAPL"))
      : await alphaVantageQuote(String(args.symbol ?? "AAPL"), secret.key)
    if (result.ok) {
      const quote = result.data as {
        symbol: string
        price: number
        currency: string
        asOf: string
        sourceUrl: string
      }
      const text = `${quote.symbol} ${quote.price} ${quote.currency} as of ${quote.asOf}`
      const snap = await Snapshot.findOneAndUpdate(
        { jobId: job._id, url: quote.sourceUrl },
        {
          jobId: job._id,
          url: quote.sourceUrl,
          text,
          sha256: createHash("sha256").update(text).digest("hex"),
          toolName: "price_quote",
          retrievedAt: new Date(),
        },
        { upsert: true, returnDocument: "after" }
      )
      result = { ok: true, data: { ...quote, snapshotId: String(snap._id) } }
    }
  } else if (tool === "crypto_quote") {
    if (!liveCrypto()) {
      result = {
        ok: false,
        code: "credential_error",
        message: "COINGECKO_API_KEY missing",
      }
    } else {
      result = await coinGeckoQuote(String(args.symbol ?? args.id ?? "bitcoin"))
      if (result.ok) {
        const quote = result.data as {
          symbol: string
          price: number
          currency: string
          asOf: string
          sourceUrl: string
        }
        const text = `${quote.symbol} ${quote.price} ${quote.currency} as of ${quote.asOf}`
        const snap = await Snapshot.findOneAndUpdate(
          { jobId: job._id, url: quote.sourceUrl },
          {
            jobId: job._id,
            url: quote.sourceUrl,
            text,
            sha256: createHash("sha256").update(text).digest("hex"),
            toolName: "crypto_quote",
            retrievedAt: new Date(),
          },
          { upsert: true, returnDocument: "after" }
        )
        result = { ok: true, data: { ...quote, snapshotId: String(snap._id) } }
      }
    }
  } else if (tool === "paper_search") {
    result = fakeModel ? await fakePaperSearch() : await openAlexSearch(String(args.query ?? ""))
  } else if (tool === "paper_get") {
    result = await fakePaperGet(String(args.id ?? args.doi ?? args.arxivId ?? ""))
    if (result.ok) {
      const data = result.data as { url: string; text: string; doi?: string }
      const snap = await Snapshot.findOneAndUpdate(
        { jobId: job._id, url: data.url },
        {
          jobId: job._id,
          url: data.url,
          text: data.text,
          sha256: createHash("sha256").update(data.text).digest("hex"),
          toolName: "paper_get",
          retrievedAt: new Date(),
        },
        { upsert: true, returnDocument: "after" }
      )
      result = { ok: true, data: { ...data, snapshotId: String(snap._id) } }
    }
  } else {
    result = { ok: false, code: "not_found", message: `Unknown tool ${tool}` }
  }

  await record(job._id, taskId, tool, args, result, source)
  return result
}

export const tools = {
  web_search: executeTool,
  fetch_page: executeTool,
  crypto_quote: executeTool,
  sec_search: executeTool,
  sec_filing: executeTool,
  price_quote: executeTool,
  paper_search: executeTool,
  paper_get: executeTool,
}
