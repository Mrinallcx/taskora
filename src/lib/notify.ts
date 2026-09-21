import { Artifact, Job, Task } from "@/src/db/models"
import { hex } from "@/src/lib/ids"

async function memoForJob(jobId: unknown) {
  const reportTask = await Task.findOne({ jobId, type: "report" })
  const artifact = await Artifact.findOne({ taskId: reportTask?._id }).sort({
    round: -1,
    attempt: -1,
  })
  return String(artifact?.payload?.markdown ?? artifact?.markdown ?? "").trim()
}

export async function notifyJobDelivered(jobId: unknown) {
  const job = await Job.findById(jobId)
  if (!job || job.status !== "delivered") return
  if (!job.emailOnDeliver || job.deliveredEmailAt) return
  const to = String(job.notifyEmail ?? "").trim()
  if (!to) return
  const key = process.env.RESEND_API_KEY
  const from = process.env.MAIL_FROM || "Multiagent <noreply@localhost>"
  const memo = await memoForJob(job._id)
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000"
  const url = `${base}/dashboard/${hex(job._id)}`
  if (!key) {
    job.deliveredEmailAt = new Date()
    await job.save()
    return
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Research memo ready: ${job.brief.slice(0, 80)}`,
      text: `${job.brief}\n\n${memo || "Open the task to read the memo."}\n\n${url}`,
    }),
  })
  if (!response.ok) {
    throw new Error(`mail ${response.status} ${await response.text()}`)
  }
  job.deliveredEmailAt = new Date()
  await job.save()
}
