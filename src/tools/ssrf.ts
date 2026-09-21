import { lookup as dnsLookup } from "node:dns/promises"

import { isBlockedIp } from "@/src/tools/net"

export type LookupFn = (
  host: string,
  options: { all: true }
) => Promise<Array<{ address: string; family: number }>>

export type HopResponse = {
  status: number
  headers: Record<string, string>
  body: Buffer
}

export type TransportFn = (input: {
  url: URL
  ip: string
}) => Promise<HopResponse>

const MAX_BYTES = Math.floor(1.5 * 1024 * 1024)

export async function resolvePublic(
  hostname: string,
  lookupFn: LookupFn = dnsLookup
) {
  const records = await lookupFn(hostname, { all: true })
  if (records.length === 0) {
    return { ok: false as const, code: "ssrf_blocked" as const, message: "No DNS records" }
  }
  if (records.some((row) => isBlockedIp(row.address))) {
    return {
      ok: false as const,
      code: "ssrf_blocked" as const,
      message: "Resolved to a private address",
    }
  }
  return { ok: true as const, addresses: records.map((row) => row.address) }
}

export function parseFetchUrl(raw: string) {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false as const, code: "ssrf_blocked" as const, message: "Invalid URL" }
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false as const, code: "ssrf_blocked" as const, message: "Scheme not allowed" }
  }
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost")) {
    return { ok: false as const, code: "ssrf_blocked" as const, message: "localhost blocked" }
  }
  return { ok: true as const, url }
}

async function defaultTransport(input: { url: URL; ip: string }): Promise<HopResponse> {
  const { url, ip } = input
  const target = new URL(url.toString())
  target.hostname = ip.includes(":") ? `[${ip}]` : ip
  const response = await fetch(target, {
    redirect: "manual",
    headers: { Host: url.hostname },
  })
  const buf = Buffer.from(await response.arrayBuffer())
  const headers: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    headers[key] = value
  })
  return { status: response.status, headers, body: buf }
}

export async function fetchValidated(
  rawUrl: string,
  opts: { lookupFn?: LookupFn; transport?: TransportFn; hops?: number } = {}
) {
  const lookupFn = opts.lookupFn ?? dnsLookup
  const transport = opts.transport ?? defaultTransport
  let current = rawUrl
  for (let hop = 0; hop <= (opts.hops ?? 2); hop += 1) {
    const parsed = parseFetchUrl(current)
    if (!parsed.ok) return parsed
    const resolved = await resolvePublic(parsed.url.hostname, lookupFn)
    if (!resolved.ok) return resolved
    const ip = resolved.addresses[0]
    const hopResult = await transport({ url: parsed.url, ip })
    if (hopResult.body.length > MAX_BYTES) {
      return { ok: false as const, code: "too_large" as const, message: "Response over 1.5MB" }
    }
    if (hopResult.status >= 300 && hopResult.status < 400) {
      const location = hopResult.headers.location || hopResult.headers.Location
      if (!location) {
        return { ok: false as const, code: "upstream_error" as const, message: "Redirect without location" }
      }
      current = new URL(location, parsed.url).toString()
      continue
    }
    if (hopResult.status >= 400) {
      return {
        ok: false as const,
        code: "upstream_error" as const,
        message: `HTTP ${hopResult.status}`,
      }
    }
    return { ok: true as const, url: parsed.url.toString(), body: hopResult.body }
  }
  return { ok: false as const, code: "ssrf_blocked" as const, message: "Too many redirects" }
}
