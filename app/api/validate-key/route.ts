import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

const TIMEOUT_MS = 8000

function isPrivateIpv4(ip: string) {
  const parts = ip.split(".").map(Number)
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return true
  }

  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  )
}

function isPrivateIp(ip: string) {
  const version = isIP(ip)
  if (version === 4) {
    return isPrivateIpv4(ip)
  }
  if (version === 6) {
    const normalized = ip.toLowerCase()
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80") ||
      (normalized.startsWith("::ffff:") &&
        isPrivateIpv4(normalized.slice("::ffff:".length)))
    )
  }
  return true
}

async function assertPublicHttpUrl(raw: string) {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error("Enter a valid endpoint URL.")
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Endpoint must be an http or https URL.")
  }

  if (url.username || url.password) {
    throw new Error("Endpoint URL cannot include credentials.")
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase()
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("That host cannot be used.")
  }

  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error("That host cannot be used.")
    }
    return url
  }

  const { address } = await lookup(hostname)
  if (isPrivateIp(address)) {
    throw new Error("That host cannot be used.")
  }

  return url
}

export async function POST(request: Request) {
  let body: { endpoint?: unknown; apiKey?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 })
  }

  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : ""
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : ""

  if (!endpoint || !apiKey) {
    return Response.json(
      { ok: false, error: "Provider key and endpoint are required." },
      { status: 400 }
    )
  }

  try {
    const url = await assertPublicHttpUrl(endpoint)
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-API-Key": apiKey,
        Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
      },
    })

    if (response.status >= 300 && response.status < 400) {
      return Response.json({
        ok: false,
        status: response.status,
        error: "Endpoint redirected. Use a direct URL.",
      })
    }

    if (response.status === 401 || response.status === 403) {
      return Response.json({
        ok: false,
        status: response.status,
        error: "Key was rejected by that endpoint.",
      })
    }

    if (!response.ok) {
      return Response.json({
        ok: false,
        status: response.status,
        error: `Endpoint returned ${response.status}.`,
      })
    }

    return Response.json({ ok: true, status: response.status })
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "Endpoint timed out."
        : error instanceof Error
          ? error.message
          : "Could not reach that endpoint."

    return Response.json({ ok: false, error: message }, { status: 400 })
  }
}
