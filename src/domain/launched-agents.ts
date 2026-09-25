export function launchedAgentKey(name: string) {
  return name.trim().toLowerCase()
}

export function launchedAgentSlug(name: string) {
  const slug = launchedAgentKey(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return slug || "agent"
}

export function launchedAgentHref(name: string) {
  return `/dashboard/agent/${launchedAgentSlug(name)}`
}

export type LaunchedTaskCard = {
  _id: string
  name: string
  domain: string
  brief: string
  status: string
  createdAt?: string
  category?: string
  symbol?: string
  companyName?: string
  symbols?: { symbol: string; name: string }[]
  workerId?: string
  workerQueued?: boolean
}

export function launchedTaskFromJob(job: {
  _id?: unknown
  name?: string
  domain?: string
  brief?: string
  status?: string
  createdAt?: Date | string
  category?: string
  symbol?: string
  companyName?: string
  symbols?: { symbol?: string; name?: string }[]
  workerId?: string
  workerQueued?: boolean
}): LaunchedTaskCard {
  return {
    _id: String(job._id ?? ""),
    name: String(job.name ?? ""),
    domain: String(job.domain ?? "general"),
    brief: String(job.brief ?? ""),
    status: String(job.status ?? ""),
    createdAt: job.createdAt ? new Date(job.createdAt).toISOString() : undefined,
    category: String(job.category ?? ""),
    symbol: String(job.symbol ?? ""),
    companyName: String(job.companyName ?? ""),
    symbols: (job.symbols ?? [])
      .filter((row) => row.symbol?.trim())
      .map((row) => ({
        symbol: String(row.symbol).trim(),
        name: String(row.name ?? "").trim(),
      })),
    workerId: String(job.workerId ?? ""),
    workerQueued: Boolean(job.workerQueued),
  }
}

export function groupLaunchedAgents<
  T extends { name?: string; createdAt?: Date },
>(jobs: T[]) {
  const order: string[] = []
  const byName = new Map<string, T[]>()
  for (const job of jobs) {
    const name = String(job.name ?? "").trim()
    if (!name) continue
    const key = launchedAgentKey(name)
    if (!byName.has(key)) {
      byName.set(key, [])
      order.push(key)
    }
    byName.get(key)!.push(job)
  }
  return order.map((key) => {
    const tasks = byName.get(key)!
    const name = String(tasks[0].name).trim()
    return {
      name,
      slug: launchedAgentSlug(name),
      tasks,
    }
  })
}

export function launchedAgentBySlug<T extends { name?: string; createdAt?: Date }>(
  jobs: T[],
  slug: string
) {
  return groupLaunchedAgents(jobs).find((row) => row.slug === slug) ?? null
}

export type LaunchedAgentOption = {
  name: string
  slug: string
  taskCount: number
  category: "stocks" | "crypto" | ""
  symbols: { symbol: string; name: string; exchange: string }[]
}

export function summarizeLaunchedAgents<
  T extends {
    name?: string
    createdAt?: Date
    category?: string
    symbol?: string
    companyName?: string
    exchange?: string
    symbols?: { symbol?: string; name?: string; exchange?: string }[]
  },
>(jobs: T[]): LaunchedAgentOption[] {
  return groupLaunchedAgents(jobs).map((agent) => {
    const latest = agent.tasks[0]
    const symbols =
      latest.symbols?.filter((row) => row.symbol?.trim()).map((row) => ({
        symbol: String(row.symbol).trim(),
        name: String(row.name ?? row.symbol).trim(),
        exchange: String(row.exchange ?? "NASDAQ").trim() || "NASDAQ",
      })) ?? []
    if (symbols.length === 0 && latest.symbol?.trim()) {
      symbols.push({
        symbol: latest.symbol.trim(),
        name: latest.companyName?.trim() || latest.symbol.trim(),
        exchange: latest.exchange?.trim() || "NASDAQ",
      })
    }
    return {
      name: agent.name,
      slug: agent.slug,
      taskCount: agent.tasks.length,
      category:
        latest.category === "crypto"
          ? "crypto"
          : latest.category === "stocks"
            ? "stocks"
            : "",
      symbols,
    }
  })
}
