export const CONNECTORS = [
  {
    id: "web_search",
    kind: "web_search" as const,
    name: "Web search",
    description: "Your search key for open-web lookups on a job.",
  },
  {
    id: "prices",
    kind: "prices" as const,
    name: "Market prices",
    description: "Your prices key for stocks and crypto quotes.",
  },
] as const

export type ConnectorKind = (typeof CONNECTORS)[number]["kind"]
