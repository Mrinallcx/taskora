import { Event, Job } from "@/src/db/models"
import { connect } from "@/src/db/connect"
import { grokDeskForJob, handoffJobToGrokBot } from "@/src/domain/grok-bot"
import {
  STOCK_WORKER_CAPACITY,
  isStockPoolJob,
  pickStockWorker,
  stockWorkerLoadsFromJobs,
  stockWorkersFromEnv,
} from "@/src/domain/stock-workers"

async function currentStockLoads() {
  await connect()
  const jobs = await Job.find({
    $or: [{ category: "stocks" }, { "symbols.0": { $exists: true } }, { symbol: { $ne: "" } }],
    status: { $in: ["funded", "planning", "in_progress", "evaluating", "revision"] },
  }).select("workerId workerQueued status")
  return stockWorkerLoadsFromJobs(
    jobs.map((row) => ({
      workerId: row.workerId,
      workerQueued: row.workerQueued,
      status: row.status,
    }))
  )
}

export async function assignStockWorkerOrQueue(job: InstanceType<typeof Job>) {
  if (!isStockPoolJob(job)) {
    await handoffJobToGrokBot(job, grokDeskForJob(job))
    return { queued: false, workerId: "" }
  }
  await assignNextQueuedStockJob()
  const worker = pickStockWorker(stockWorkersFromEnv(), await currentStockLoads())
  if (!worker) {
    job.workerId = ""
    job.workerQueued = true
    await job.save()
    await Event.create({
      jobId: job._id,
      type: "stock_worker_queued",
      payload: {},
      at: new Date(),
    })
    return { queued: true, workerId: "" }
  }
  job.workerId = worker.id
  job.workerQueued = false
  await job.save()
  await Event.create({
    jobId: job._id,
    type: "stock_worker_assigned",
    payload: { workerId: worker.id },
    at: new Date(),
  })
  await handoffJobToGrokBot(job, {
    webhookUrl: worker.webhookUrl,
    webhookKey: worker.webhookKey,
  })
  return { queued: false, workerId: worker.id }
}

export async function assignNextQueuedStockJob() {
  await connect()
  const queued = await Job.find({
    workerQueued: true,
    status: "in_progress",
    $or: [{ category: "stocks" }, { "symbols.0": { $exists: true } }, { symbol: { $ne: "" } }],
  }).sort({ createdAt: 1 })
  for (const job of queued) {
    const worker = pickStockWorker(stockWorkersFromEnv(), await currentStockLoads())
    if (!worker) return
    job.workerId = worker.id
    job.workerQueued = false
    await job.save()
    await Event.create({
      jobId: job._id,
      type: "stock_worker_assigned",
      payload: { workerId: worker.id, fromQueue: true },
      at: new Date(),
    })
    await handoffJobToGrokBot(job, {
      webhookUrl: worker.webhookUrl,
      webhookKey: worker.webhookKey,
    })
  }
}

export async function stockWorkerAvailability() {
  await assignNextQueuedStockJob()
  const workers = stockWorkersFromEnv()
  const loads = await currentStockLoads()
  const available = workers.filter(
    (row) => Boolean(row.webhookUrl) && (loads[row.id] ?? 0) < STOCK_WORKER_CAPACITY
  )
  return {
    available: available.length,
    capacity: STOCK_WORKER_CAPACITY,
    desks: workers.map((row) => ({
      id: row.id,
      configured: Boolean(row.webhookUrl),
      load: loads[row.id] ?? 0,
    })),
  }
}
