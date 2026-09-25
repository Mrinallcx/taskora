import { describe, expect, it } from "vitest"
import {
  availableCryptoWorkerCount,
  cryptoWorkerLoadsFromJobs,
  cryptoWorkersFromEnv,
  isCryptoPoolJob,
  pickCryptoWorker,
  CRYPTO_WORKER_CAPACITY,
} from "./crypto-workers"
import { isStockPoolJob } from "./stock-workers"

const workers = cryptoWorkersFromEnv({
  GROK_BOT_CRYPTO_WEBHOOK_URL: "https://example.test/1",
  GROK_BOT_CRYPTO_WEBHOOK_KEY: "one",
  GROK_BOT_CRYPTO_2_WEBHOOK_URL: "https://example.test/2",
  GROK_BOT_CRYPTO_2_WEBHOOK_KEY: "two",
})

describe("crypto-workers", () => {
  it("maps the crypto webhook onto desk 1", () => {
    expect(workers[0]).toMatchObject({
      id: "crypto-1",
      webhookUrl: "https://example.test/1",
    })
    expect(workers[1].id).toBe("crypto-2")
    expect(workers.filter((row) => row.webhookUrl).length).toBe(2)
  })

  it("fills the first desk, then the second", () => {
    expect(
      pickCryptoWorker(workers, { "crypto-1": CRYPTO_WORKER_CAPACITY })?.id
    ).toBe("crypto-2")
    expect(pickCryptoWorker(workers, { "crypto-1": 3 })?.id).toBe("crypto-1")
  })

  it("returns no worker when every configured desk is full", () => {
    expect(
      pickCryptoWorker(workers, {
        "crypto-1": CRYPTO_WORKER_CAPACITY,
        "crypto-2": CRYPTO_WORKER_CAPACITY,
      })
    ).toBeNull()
  })

  it("counts busy assigned jobs only", () => {
    const loads = cryptoWorkerLoadsFromJobs([
      { workerId: "crypto-1", status: "in_progress" },
      { workerId: "crypto-1", status: "in_progress", workerQueued: true },
      { workerId: "crypto-1", status: "delivered" },
      { workerId: "crypto-2", status: "in_progress" },
    ])
    expect(loads["crypto-1"]).toBe(1)
    expect(loads["crypto-2"]).toBe(1)
    expect(availableCryptoWorkerCount(workers, loads)).toBe(2)
  })

  it("keeps crypto jobs off the stocks pool", () => {
    const job = {
      category: "crypto",
      symbol: "BTC",
      symbols: [{ symbol: "BTC" }],
    }
    expect(isCryptoPoolJob(job)).toBe(true)
    expect(isStockPoolJob(job)).toBe(false)
  })
})
