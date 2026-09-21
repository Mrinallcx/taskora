import type { SearchHit, ToolResult } from "@/src/tools/types"

export async function serperSearch(
  query: string,
  apiKey: string,
  n = 5
): Promise<ToolResult<{ hits: SearchHit[] }>> {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({ q: query, num: n }),
  })
  if (response.status === 401 || response.status === 403) {
    return { ok: false, code: "credential_error", message: "Search key rejected" }
  }
  if (!response.ok) {
    return { ok: false, code: "upstream_error", message: `Serper ${response.status}` }
  }
  const json = (await response.json()) as {
    organic?: { title?: string; link?: string; snippet?: string }[]
  }
  return {
    ok: true,
    data: {
      hits: (json.organic ?? []).slice(0, n).map((row) => ({
        title: row.title ?? "",
        url: row.link ?? "",
        snippet: row.snippet ?? "",
      })),
    },
  }
}
