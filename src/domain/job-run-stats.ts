export type JobRunEvent = {
  type?: string
  at?: Date | string
  payload?: unknown
}

export type TokenUsage = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export type JobRunStats = {
  at: string | null
  responseMs: number | null
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
}

function asDate(value?: Date | string | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(+date) ? null : date
}

function asCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value)
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed >= 0) return Math.round(parsed)
  }
  return null
}

function pickUsage(row: Record<string, unknown>): TokenUsage | null {
  const input = asCount(
    row.inputTokens ?? row.input_tokens ?? row.prompt_tokens ?? row.promptTokens
  )
  const output = asCount(
    row.outputTokens ??
      row.output_tokens ??
      row.completion_tokens ??
      row.completionTokens
  )
  const total = asCount(row.totalTokens ?? row.total_tokens ?? row.tokens)
  if (input == null && output == null && total == null) return null
  const inputTokens = input ?? 0
  const outputTokens = output ?? 0
  return {
    inputTokens,
    outputTokens,
    totalTokens: total ?? inputTokens + outputTokens,
  }
}

export function extractTokenUsage(body: unknown): TokenUsage | null {
  if (typeof body === "number") {
    const total = asCount(body)
    return total == null
      ? null
      : { inputTokens: 0, outputTokens: 0, totalTokens: total }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return null
  const row = body as Record<string, unknown>
  const nested = [row.usage, row.token_usage, row.tokenUsage, row.tokens]
  for (const item of nested) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const usage = pickUsage(item as Record<string, unknown>)
      if (usage) return usage
    }
  }
  return pickUsage(row)
}

export function formatResponseTime(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export function jobRunStats(input: {
  createdAt?: Date | string
  deliveredAt?: Date | string
  events?: JobRunEvent[]
}): JobRunStats {
  const events = input.events ?? []
  const dispatched = events.find((row) => row.type === "grok_bot_dispatched")
  const completed = events.find((row) => row.type === "grok_bot_completed")
  const start = asDate(dispatched?.at) ?? asDate(input.createdAt)
  const end = asDate(completed?.at) ?? asDate(input.deliveredAt)
  const when = end ?? start
  const usage = extractTokenUsage(completed?.payload)
  return {
    at: when ? when.toISOString() : null,
    responseMs: start && end && end >= start ? end.getTime() - start.getTime() : null,
    inputTokens: usage?.inputTokens ?? null,
    outputTokens: usage?.outputTokens ?? null,
    totalTokens: usage?.totalTokens ?? null,
  }
}
