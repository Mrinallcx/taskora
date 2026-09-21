import { extractText } from "@/src/tools/html"
import { parseFetchUrl, resolvePublic } from "@/src/tools/ssrf"
import type { ToolResult } from "@/src/tools/types"

const TIMEOUT_MS = 8000
const MAX_CHARS = 8000

export async function fetchCustomApi(
  endpoint: string,
  apiKey: string
): Promise<ToolResult<{ url: string; text: string }>> {
  const parsed = parseFetchUrl(endpoint)
  if (!parsed.ok) return parsed
  const resolved = await resolvePublic(parsed.url.hostname)
  if (!resolved.ok) return resolved

  try {
    const response = await fetch(parsed.url, {
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
      return { ok: false, code: "upstream_error", message: "Endpoint redirected" }
    }
    if (response.status === 401 || response.status === 403) {
      return { ok: false, code: "credential_error", message: "Key was rejected" }
    }
    if (!response.ok) {
      return {
        ok: false,
        code: "upstream_error",
        message: `Custom API returned ${response.status}`,
      }
    }
    const raw = await response.text()
    const text = extractText(raw, MAX_CHARS)
    if (!text) {
      return { ok: false, code: "not_found", message: "Empty custom API body" }
    }
    return { ok: true, data: { url: parsed.url.toString(), text } }
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "Custom API timed out"
        : error instanceof Error
          ? error.message
          : "Could not reach custom API"
    return { ok: false, code: "upstream_error", message }
  }
}
