export const STOCK_WORKER_COUNT = 10
export const STOCK_WORKER_CAPACITY = 10

export const STOCK_BUSY_STATUSES = [
  "funded",
  "planning",
  "in_progress",
  "evaluating",
  "revision",
] as const

export type StockWorker = {
  id: string
  index: number
  label: string
  webhookUrl: string
  webhookKey: string
}

export type StockWorkerJob = {
  workerId?: string
  workerQueued?: boolean
  status: string
}

export function stockWorkerId(index: number) {
  return `stock-${index}`
}

export function stockWorkersFromEnv(
  env: Record<string, string | undefined> = process.env
): StockWorker[] {
  const workers: StockWorker[] = []
  for (let index = 1; index <= STOCK_WORKER_COUNT; index += 1) {
    const numberedUrl = (env[`GROK_BOT_STOCKS_${index}_WEBHOOK_URL`] ?? "").trim()
    const numberedKey = (env[`GROK_BOT_STOCKS_${index}_WEBHOOK_KEY`] ?? "").trim()
    const fallbackUrl =
      index === 1 ? (env.GROK_BOT_STOCKS_WEBHOOK_URL ?? "").trim() : ""
    const fallbackKey =
      index === 1 ? (env.GROK_BOT_STOCKS_WEBHOOK_KEY ?? "").trim() : ""
    workers.push({
      id: stockWorkerId(index),
      index,
      label: `Stock desk ${index}`,
      webhookUrl: numberedUrl || fallbackUrl,
      webhookKey: numberedKey || fallbackKey,
    })
  }
  return workers
}

export function stockWorkerById(
  id: string,
  env: Record<string, string | undefined> = process.env
) {
  return stockWorkersFromEnv(env).find((row) => row.id === id) ?? null
}

export function isStockPoolJob(job: {
  category?: string
  symbol?: string
  symbols?: unknown[]
}) {
  if (job.category === "crypto") return false
  return (
    job.category === "stocks" ||
    Boolean(job.symbol?.trim()) ||
    (Array.isArray(job.symbols) && job.symbols.length > 0)
  )
}

export function stockWorkerLoadsFromJobs(jobs: StockWorkerJob[]) {
  const loads: Record<string, number> = {}
  for (const job of jobs) {
    if (job.workerQueued || !job.workerId) continue
    if (!STOCK_BUSY_STATUSES.includes(job.status as (typeof STOCK_BUSY_STATUSES)[number])) {
      continue
    }
    loads[job.workerId] = (loads[job.workerId] ?? 0) + 1
  }
  return loads
}

export function pickStockWorker(
  workers: StockWorker[],
  loads: Record<string, number>
) {
  return (
    workers.find(
      (row) =>
        Boolean(row.webhookUrl) &&
        (loads[row.id] ?? 0) < STOCK_WORKER_CAPACITY
    ) ?? null
  )
}

export function availableStockWorkerCount(
  workers: StockWorker[],
  loads: Record<string, number>
) {
  return workers.filter(
    (row) =>
      Boolean(row.webhookUrl) && (loads[row.id] ?? 0) < STOCK_WORKER_CAPACITY
  ).length
}

export function stockWorkersAvailableCopy(count: number) {
  if (count <= 0) return "No workers available"
  if (count === 1) return "1 worker available"
  return `${count} workers available`
}

export function stockJobAssignmentCopy(job: {
  workerQueued?: boolean
  workerId?: string
}) {
  if (job.workerQueued || !job.workerId) return "Waiting for a worker"
  return "Worker assigned"
}
