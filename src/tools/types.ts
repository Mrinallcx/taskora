export type ToolErrorCode =
  | "ssrf_blocked"
  | "cap_exceeded"
  | "credential_error"
  | "not_allowed_for_domain"
  | "upstream_error"
  | "not_found"
  | "too_large"

export type ToolResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ToolErrorCode; message: string }

export type SearchHit = { title: string; url: string; snippet: string }
export type FilingHit = {
  accession: string
  form: string
  filedAt: string
  company: string
  url: string
}
export type PriceQuote = {
  symbol: string
  price: number
  currency: string
  asOf: string
  sourceUrl: string
}
export type PaperHit = {
  id: string
  title: string
  doi?: string
  arxivId?: string
  year?: number
  url: string
}
