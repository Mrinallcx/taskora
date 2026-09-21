export function tokenCents(inputTokens: number, outputTokens: number) {
  return Math.ceil((inputTokens * 35 + outputTokens * 75) / 1_000_000)
}

export function toolCents(tool: string) {
  return tool === "web_search" || tool === "fetch_page" ? 1 : 2
}
