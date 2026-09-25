export const CRYPTO_WORKER_COUNT = 10
export const CRYPTO_WORKER_CAPACITY = 10

export const CRYPTO_BUSY_STATUSES = [
  "funded",
  "planning",
  "in_progress",
  "evaluating",
  "revision",
] as const

export type CryptoWorker = {
  id: string
  index: number
  label: string
  webhookUrl: string
  webhookKey: string
}

export type CryptoWorkerJob = {
  workerId?: string
  workerQueued?: boolean
  status: string
}

export function cryptoWorkerId(index: number) {
  return `crypto-${index}`
}

export function cryptoWorkersFromEnv(
  env: Record<string, string | undefined> = process.env
): CryptoWorker[] {
  const workers: CryptoWorker[] = []
  for (let index = 1; index <= CRYPTO_WORKER_COUNT; index += 1) {
    const numberedUrl = (env[`GROK_BOT_CRYPTO_${index}_WEBHOOK_URL`] ?? "").trim()
    const numberedKey = (env[`GROK_BOT_CRYPTO_${index}_WEBHOOK_KEY`] ?? "").trim()
    const fallbackUrl =
      index === 1 ? (env.GROK_BOT_CRYPTO_WEBHOOK_URL ?? "").trim() : ""
    const fallbackKey =
      index === 1 ? (env.GROK_BOT_CRYPTO_WEBHOOK_KEY ?? "").trim() : ""
    workers.push({
      id: cryptoWorkerId(index),
      index,
      label: `Crypto desk ${index}`,
      webhookUrl: numberedUrl || fallbackUrl,
      webhookKey: numberedKey || fallbackKey,
    })
  }
  return workers
}

export function cryptoWorkerById(
  id: string,
  env: Record<string, string | undefined> = process.env
) {
  return cryptoWorkersFromEnv(env).find((row) => row.id === id) ?? null
}

export function isCryptoPoolJob(job: { category?: string }) {
  return job.category === "crypto"
}

export function cryptoWorkerLoadsFromJobs(jobs: CryptoWorkerJob[]) {
  const loads: Record<string, number> = {}
  for (const job of jobs) {
    if (job.workerQueued || !job.workerId) continue
    if (!CRYPTO_BUSY_STATUSES.includes(job.status as (typeof CRYPTO_BUSY_STATUSES)[number])) {
      continue
    }
    loads[job.workerId] = (loads[job.workerId] ?? 0) + 1
  }
  return loads
}

export function pickCryptoWorker(
  workers: CryptoWorker[],
  loads: Record<string, number>
) {
  return (
    workers.find(
      (row) =>
        Boolean(row.webhookUrl) &&
        (loads[row.id] ?? 0) < CRYPTO_WORKER_CAPACITY
    ) ?? null
  )
}

export function availableCryptoWorkerCount(
  workers: CryptoWorker[],
  loads: Record<string, number>
) {
  return workers.filter(
    (row) =>
      Boolean(row.webhookUrl) && (loads[row.id] ?? 0) < CRYPTO_WORKER_CAPACITY
  ).length
}
