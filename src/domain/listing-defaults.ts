export function domainFromListingTools(tools: string[] = []) {
  if (tools.includes("stocks") || tools.includes("crypto")) return "finance"
  return "general"
}

export function budgetFromListing(priceCents: number) {
  if (priceCents >= 2000 && priceCents <= 10000) return priceCents
  return 2000
}

export function listingKindLabel(kind: string) {
  if (kind === "lead") return "agent"
  return kind
}
