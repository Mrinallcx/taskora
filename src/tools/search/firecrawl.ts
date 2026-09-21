import { extractText } from "@/src/tools/html"
import type { SearchHit, ToolResult } from "@/src/tools/types"

const BASE = "https://api.firecrawl.dev/v2"

function headers() {
  const key = process.env.FIRECRAWL_API_KEY
  if (!key) return null
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  }
}

function asHits(json: unknown): SearchHit[] {
  const root = json as {
    data?: { web?: unknown[]; news?: unknown[] } | unknown[]
    web?: unknown[]
  }
  const rows = Array.isArray(root.data)
    ? root.data
    : (root.data?.web ?? root.web ?? [])
  return rows
    .map((row) => {
      const item = row as {
        title?: string
        url?: string
        link?: string
        description?: string
        snippet?: string
        markdown?: string
      }
      return {
        title: item.title ?? "",
        url: item.url ?? item.link ?? "",
        snippet: item.description ?? item.snippet ?? item.markdown?.slice(0, 240) ?? "",
      }
    })
    .filter((hit) => hit.url.startsWith("http"))
}

export async function firecrawlSearch(
  query: string,
  n = 5
): Promise<ToolResult<{ hits: SearchHit[] }>> {
  const auth = headers()
  if (!auth) {
    return { ok: false, code: "credential_error", message: "FIRECRAWL_API_KEY missing" }
  }
  let last: ToolResult<{ hits: SearchHit[] }> = {
    ok: false,
    code: "upstream_error",
    message: "Firecrawl search failed",
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${BASE}/search`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ query, limit: Math.min(Math.max(n, 1), 8) }),
    })
    if (response.status === 401 || response.status === 403) {
      return { ok: false, code: "credential_error", message: "Firecrawl key rejected" }
    }
    if (response.status === 429 || response.status === 502 || response.status === 503) {
      last = {
        ok: false,
        code: "upstream_error",
        message: `Firecrawl search ${response.status}`,
      }
      await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)))
      continue
    }
    if (!response.ok) {
      return { ok: false, code: "upstream_error", message: `Firecrawl search ${response.status}` }
    }
    const json = await response.json()
    const hits = asHits(json).slice(0, n)
    if (hits.length === 0) {
      return { ok: false, code: "not_found", message: "No search hits" }
    }
    return { ok: true, data: { hits } }
  }
  return last
}

export async function firecrawlScrape(
  url: string
): Promise<ToolResult<{ url: string; text: string }>> {
  const auth = headers()
  if (!auth) {
    return { ok: false, code: "credential_error", message: "FIRECRAWL_API_KEY missing" }
  }
  let last: ToolResult<{ url: string; text: string }> = {
    ok: false,
    code: "upstream_error",
    message: "Firecrawl scrape failed",
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${BASE}/scrape`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ url, formats: ["markdown"] }),
    })
    if (response.status === 401 || response.status === 403) {
      return { ok: false, code: "credential_error", message: "Firecrawl key rejected" }
    }
    if (response.status === 429 || response.status === 502 || response.status === 503) {
      last = {
        ok: false,
        code: "upstream_error",
        message: `Firecrawl scrape ${response.status}`,
      }
      await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)))
      continue
    }
    if (!response.ok) {
      return { ok: false, code: "upstream_error", message: `Firecrawl scrape ${response.status}` }
    }
    const json = (await response.json()) as {
      data?: { markdown?: string; content?: string; html?: string }
      markdown?: string
    }
    const raw =
      json.data?.markdown ?? json.data?.content ?? json.data?.html ?? json.markdown ?? ""
    const text = extractText(raw)
    if (!text) {
      return { ok: false, code: "not_found", message: "Empty extract" }
    }
    return { ok: true, data: { url, text } }
  }
  return last
}
