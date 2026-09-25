import { Event, Job } from "@/src/db/models"
import { connect } from "@/src/db/connect"
import { grokDeskForJob, handoffJobToGrokBot } from "@/src/domain/grok-bot"
import {
  CRYPTO_WORKER_CAPACITY,
  cryptoWorkerLoadsFromJobs,
  cryptoWorkersFromEnv,
  isCryptoPoolJob,
  pickCryptoWorker,
} from "@/src/domain/crypto-workers"

async function currentCryptoLoads() {
  await connect()
  const jobs = await Job.find({
    category: "crypto",
    status: { $in: ["funded", "planning", "in_progress", "evaluating", "revision"] },
  }).select("workerId workerQueued status")
  return cryptoWorkerLoadsFromJobs(
    jobs.map((row) => ({
      workerId: row.workerId,
      workerQueued: row.workerQueued,
      status: row.status,
    }))
  )
}

export async function assignCryptoWorkerOrQueue(job: InstanceType<typeof Job>) {
  if (!isCryptoPoolJob(job)) {
    await handoffJobToGrokBot(job, grokDeskForJob(job))
    return { queued: false, workerId: "" }
  }
  await assignNextQueuedCryptoJob()
  const worker = pickCryptoWorker(cryptoWorkersFromEnv(), await currentCryptoLoads())
  if (!worker) {
    job.workerId = ""
    job.workerQueued = true
    await job.save()
    await Event.create({
      jobId: job._id,
      type: "crypto_worker_queued",
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
    type: "crypto_worker_assigned",
    payload: { workerId: worker.id },
    at: new Date(),
  })
  await handoffJobToGrokBot(job, {
    webhookUrl: worker.webhookUrl,
    webhookKey: worker.webhookKey,
  })
  return { queued: false, workerId: worker.id }
}

export async function assignNextQueuedCryptoJob() {
  await connect()
  const queued = await Job.find({
    workerQueued: true,
    status: "in_progress",
    category: "crypto",
  }).sort({ createdAt: 1 })
  for (const job of queued) {
    const worker = pickCryptoWorker(cryptoWorkersFromEnv(), await currentCryptoLoads())
    if (!worker) return
    job.workerId = worker.id
    job.workerQueued = false
    await job.save()
    await Event.create({
      jobId: job._id,
      type: "crypto_worker_assigned",
      payload: { workerId: worker.id, fromQueue: true },
      at: new Date(),
    })
    await handoffJobToGrokBot(job, {
      webhookUrl: worker.webhookUrl,
      webhookKey: worker.webhookKey,
    })
  }
}

export async function cryptoWorkerAvailability() {
  await assignNextQueuedCryptoJob()
  const workers = cryptoWorkersFromEnv()
  const loads = await currentCryptoLoads()
  const available = workers.filter(
    (row) => Boolean(row.webhookUrl) && (loads[row.id] ?? 0) < CRYPTO_WORKER_CAPACITY
  )
  return {
    available: available.length,
    capacity: CRYPTO_WORKER_CAPACITY,
    desks: workers.map((row) => ({
      id: row.id,
      configured: Boolean(row.webhookUrl),
      load: loads[row.id] ?? 0,
    })),
  }
}
