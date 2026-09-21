export const DOMAIN_TOOLS = {
  general: ["web_search", "fetch_page", "crypto_quote"],
  finance: [
    "web_search",
    "fetch_page",
    "sec_search",
    "sec_filing",
    "price_quote",
  ],
  academic: ["web_search", "fetch_page", "paper_search", "paper_get"],
} as const

export type ResearchDomain = keyof typeof DOMAIN_TOOLS

export function isIndependent(evaluatorOwner: string, workerOwners: string[]) {
  if (evaluatorOwner === "platform") return true
  return !workerOwners.includes(evaluatorOwner)
}

export function toolsForDomain(domain: string) {
  if (domain === "general" || domain === "finance" || domain === "academic") {
    return [...DOMAIN_TOOLS[domain]]
  }
  return []
}

export function toolAllowed(domain: string, tool: string) {
  return toolsForDomain(domain).includes(tool as never)
}
