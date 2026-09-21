import type { ConnectorKind } from "@/src/domain/connectors"

export type AppCategory = "all" | "search" | "finance" | "academic" | "data"

export type AppAuth = "apikey" | "platform" | "listing"

export type ResearchApp = {
  id: string
  name: string
  description: string
  category: Exclude<AppCategory, "all">
  auth: AppAuth
  maintainer: string
  featured?: boolean
  kind?: ConnectorKind
  domains: Array<"general" | "finance" | "academic">
  hint?: string
}

export const APP_CATEGORIES: { id: AppCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "search", label: "Search" },
  { id: "finance", label: "Finance" },
  { id: "academic", label: "Academic" },
  { id: "data", label: "Data" },
]

export const RESEARCH_APPS: ResearchApp[] = [
  {
    id: "web_search",
    name: "Web search",
    description: "Open-web lookups. Connect your key to use it on a job.",
    category: "search",
    auth: "apikey",
    maintainer: "Serper",
    featured: true,
    kind: "web_search",
    domains: ["general", "finance", "academic"],
    hint: "Paste a Serper API key.",
  },
  {
    id: "prices",
    name: "Market prices",
    description: "Stock quotes for finance jobs. Connect your key to use it.",
    category: "finance",
    auth: "apikey",
    maintainer: "Alpha Vantage",
    featured: true,
    kind: "prices",
    domains: ["finance"],
    hint: "Paste an Alpha Vantage API key.",
  },
  {
    id: "fetch_page",
    name: "Fetch page",
    description: "Pulls the full page so a memo can quote it.",
    category: "search",
    auth: "platform",
    maintainer: "Firecrawl",
    featured: true,
    domains: ["general", "finance", "academic"],
  },
  {
    id: "crypto",
    name: "Crypto quotes",
    description: "Live coin prices on general research jobs.",
    category: "finance",
    auth: "platform",
    maintainer: "CoinGecko",
    featured: true,
    domains: ["general"],
  },
  {
    id: "sec",
    name: "SEC filings",
    description: "Company filings for finance memos.",
    category: "finance",
    auth: "platform",
    maintainer: "EDGAR",
    featured: true,
    domains: ["finance"],
  },
  {
    id: "papers",
    name: "Academic papers",
    description: "Scholarly search for academic jobs.",
    category: "academic",
    auth: "platform",
    maintainer: "OpenAlex",
    featured: true,
    domains: ["academic"],
  },
  {
    id: "custom_api",
    name: "Custom API",
    description: "Your HTTP endpoints, added on a worker listing.",
    category: "data",
    auth: "listing",
    maintainer: "You",
    domains: ["general", "finance", "academic"],
  },
]

export const AUTH_LABELS: Record<AppAuth, string> = {
  apikey: "API Key",
  platform: "On jobs",
  listing: "Worker listing",
}

export function featuredApps() {
  return RESEARCH_APPS.filter((app) => app.featured)
}

export function connectableApps() {
  return RESEARCH_APPS.filter(
    (app): app is ResearchApp & { kind: ConnectorKind } =>
      app.auth === "apikey" && Boolean(app.kind)
  )
}
