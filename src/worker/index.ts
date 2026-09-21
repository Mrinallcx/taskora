import { Job, Listing, Task, Artifact, Snapshot } from "@/src/db/models"
import { runAgent } from "@/src/agent/run-agent"
import { connect } from "@/src/db/connect"
import {
  applyPlan,
  approvePlan,
  claimQueuedTask,
  evaluateTask,
  expireIdlePlans,
  markTaskTimeout,
  reapLocks,
  reportHardFails,
  settleDueJobs,
  submitWorkerTask,
} from "@/src/domain/jobs"
import { formatHireCatalog } from "@/src/domain/listing-catalog"
import { runDueListings } from "@/src/domain/listing-jobs"
import { gatherInDepthSources } from "@/src/domain/research"
import { CITABLE_TOOLS } from "@/src/domain/evidence"
import { hex } from "@/src/lib/ids"
import { loadLocalEnv } from "@/src/lib/load-env"

const WORKER_ID = `worker-${process.pid}`

async function postInternal(path: string, body: unknown) {
  if (process.env.WORKER_IN_PROCESS === "1") {
    const id = path.split("/")[4]
    if (path.includes("/plan")) {
      return applyPlan(id, body as never)
    }
    if (path.includes("/evaluate")) {
      return evaluateTask(id, body as never)
    }
    return submitWorkerTask(id, body as Record<string, unknown>)
  }
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000"
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WORKER_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`internal ${path} ${response.status} ${text}`)
  }
  return response.json()
}

async function runClaimed() {
  const claimed = await claimQueuedTask(WORKER_ID)
  if (!claimed?.task || !claimed.job || !claimed.listing) return false
  const { task, job, listing } = claimed
  const timeout = setTimeout(() => {
    void markTaskTimeout(task._id)
  }, task.timeoutMs)

  try {
    if (task.type === "sources") {
      await gatherInDepthSources(job, task._id, listing)
    }
    if (task.type === "report") {
      const citable = await Snapshot.countDocuments({
        jobId: job._id,
        toolName: { $in: [...CITABLE_TOOLS] },
      })
      if (citable < 5) {
        await gatherInDepthSources(job, task._id, listing)
      }
    }
    if (task.type === "evaluate") {
      const hardFails = await reportHardFails(job._id)
      if (hardFails.length > 0) {
        await postInternal(`/api/internal/tasks/${hex(task._id)}/evaluate`, {
          scores: null,
          pass: false,
          hardFails,
          comments: "deterministic hard fail",
        })
        return true
      }
    }

    const reportTask =
      task.type === "evaluate"
        ? await Task.findOne({ jobId: job._id, type: "report" })
        : null
    const reportListing =
      reportTask?.listingId && task.type === "evaluate"
        ? await Listing.findById(reportTask.listingId)
        : null
    const reportArtifact =
      reportTask && task.type === "evaluate"
        ? await Artifact.findOne({ taskId: reportTask._id }).sort({
            round: -1,
            attempt: -1,
          })
        : null
    const catalog =
      task.type === "plan"
        ? await formatHireCatalog({
            brief: [job.brief, job.instructions].filter(Boolean).join("\n"),
            leadSkills: listing.skills,
          })
        : undefined

    const output = await runAgent({
      kind: listing.kind,
      type: task.type,
      jobId: hex(job._id),
      round: job.revisionsUsed,
      summary: String(listing.summary ?? ""),
      instructions: [job.instructions, listing.prompt]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
        .join("\n\n"),
      skills: String(listing.skills ?? ""),
      workerSkills:
        task.type === "evaluate" ? String(reportListing?.skills ?? "") : undefined,
      catalog,
      memo:
        task.type === "evaluate"
          ? String(reportArtifact?.markdown ?? "")
          : undefined,
    })

    if (task.type === "plan") {
      await postInternal(`/api/internal/jobs/${hex(job._id)}/plan`, output)
      const fresh = await Job.findById(job._id)
      if (fresh?.autoApprovePlan && fresh.status === "plan_review") {
        await approvePlan(fresh.userId, hex(fresh._id))
      }
      return true
    }
    if (task.type === "evaluate") {
      await postInternal(`/api/internal/tasks/${hex(task._id)}/evaluate`, output)
      return true
    }
    await postInternal(`/api/internal/tasks/${hex(task._id)}/submit`, {
      ...output,
      jobId: hex(job._id),
    })
    return true
  } catch (error) {
    console.error(`task ${task.type} failed:`, error)
    if (task.type === "plan") {
      await markTaskTimeout(task._id)
      return true
    }
    return true
  } finally {
    clearTimeout(timeout)
  }
}

export async function tick() {
  await runDueListings()
  await reapLocks()
  await settleDueJobs()
  await expireIdlePlans()
  const ran = await runClaimed()
  return ran
}

export async function drain(max = 40) {
  for (let i = 0; i < max; i += 1) {
    const ran = await tick()
    if (!ran) break
  }
}

async function loop() {
  process.env.WORKER_IN_PROCESS ??= "1"
  await connect()
  for (;;) {
    try {
      await tick()
    } catch (error) {
      console.error(error)
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}

const isMain = process.argv[1]?.includes("worker")
if (isMain) {
  loadLocalEnv()
  void loop()
}
