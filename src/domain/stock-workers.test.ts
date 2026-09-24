import { describe, expect, it } from "vitest"
import {
  availableStockWorkerCount,
  pickStockWorker,
  stockWorkerLoadsFromJobs,
  stockJobAssignmentCopy,
  stockWorkersAvailableCopy,
  stockWorkersFromEnv,
  STOCK_WORKER_CAPACITY,
} from "./stock-workers"

const workers = stockWorkersFromEnv({
  GROK_BOT_STOCKS_WEBHOOK_URL: "https://example.test/1",
  GROK_BOT_STOCKS_WEBHOOK_KEY: "one",
  GROK_BOT_STOCKS_2_WEBHOOK_URL: "https://example.test/2",
  GROK_BOT_STOCKS_2_WEBHOOK_KEY: "two",
})

describe("stock-workers", () => {
  it("maps the legacy stocks webhook onto desk 1", () => {
    expect(workers[0]).toMatchObject({
      id: "stock-1",
      webhookUrl: "https://example.test/1",
    })
    expect(workers[1].id).toBe("stock-2")
    expect(workers.filter((row) => row.webhookUrl).length).toBe(2)
  })

  it("fills the first desk, then the second", () => {
    const fullFirst = {
      "stock-1": STOCK_WORKER_CAPACITY,
      "stock-2": 1,
    }
    expect(pickStockWorker(workers, fullFirst)?.id).toBe("stock-2")
    expect(pickStockWorker(workers, { "stock-1": 3 })?.id).toBe("stock-1")
  })

  it("returns no worker when every configured desk is full", () => {
    expect(
      pickStockWorker(workers, {
        "stock-1": STOCK_WORKER_CAPACITY,
        "stock-2": STOCK_WORKER_CAPACITY,
      })
    ).toBeNull()
  })

  it("counts busy assigned jobs only", () => {
    const loads = stockWorkerLoadsFromJobs([
      { workerId: "stock-1", status: "in_progress" },
      { workerId: "stock-1", status: "in_progress", workerQueued: true },
      { workerId: "stock-1", status: "delivered" },
      { workerId: "stock-2", status: "in_progress" },
    ])
    expect(loads["stock-1"]).toBe(1)
    expect(loads["stock-2"]).toBe(1)
    expect(availableStockWorkerCount(workers, loads)).toBe(2)
  })

  it("writes availability copy", () => {
    expect(stockWorkersAvailableCopy(10)).toBe("10 workers available")
    expect(stockWorkersAvailableCopy(1)).toBe("1 worker available")
    expect(stockWorkersAvailableCopy(0)).toBe("No workers available")
  })

  it("writes queued versus assigned copy", () => {
    expect(stockJobAssignmentCopy({ workerQueued: true })).toBe(
      "Waiting for a worker"
    )
    expect(stockJobAssignmentCopy({ workerId: "stock-1" })).toBe(
      "Worker assigned"
    )
  })
})
