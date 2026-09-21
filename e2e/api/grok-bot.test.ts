import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { Artifact, Job, Task } from "@/src/db/models"
import {
  applyGrokBotMemo,
  createGrokBotJob,
  grokBotTestEnabled,
  grokCallbackToken,
  grokCallbackTokenOk,
} from "@/src/domain/grok-bot"
import { getSessionUser } from "@/src/lib/auth"
import { hex } from "@/src/lib/ids"
import { startTestMongo, stopTestMongo } from "@/e2e/api/setup"

beforeAll(async () => {
  await startTestMongo()
})

afterAll(async () => {
  await stopTestMongo()
})

function req() {
  return new Request("http://localhost/api/me", {
    headers: { authorization: "Bearer test:grok-bot" },
  })
}

describe("Grok Bot test sidecar", () => {
  it("does not dispatch from hire during vitest", () => {
    expect(grokBotTestEnabled()).toBe(false)
  })
  it("writes a memo onto a waiting job via callback", async () => {
    const user = await getSessionUser(req())
    const created = await createGrokBotJob(user, {
      brief: "What is a research desk?",
    })
    expect(created.ping.pinged).toBe(false)
    expect(created.job.status).toBe("in_progress")
    const jobId = hex(created.job._id)
    expect(grokCallbackTokenOk(jobId, grokCallbackToken(jobId))).toBe(true)

    const memo = "# MEMO: research desk\n\nA desk cites pages. A chatbot does not."
    const applied = await applyGrokBotMemo(jobId, { markdown: memo })
    expect(applied.job.status).toBe("delivered")
    expect(applied.markdown).toContain("research desk")

    const task = await Task.findOne({ jobId: created.job._id, type: "report" })
    expect(task?.status).toBe("passed_schema")
    const artifact = await Artifact.findOne({ jobId: created.job._id })
    expect(artifact?.markdown).toContain("A desk cites pages")
    const fresh = await Job.findById(created.job._id)
    expect(fresh?.status).toBe("delivered")
  })

  it("rejects callback on a normal job", async () => {
    const user = await getSessionUser(req())
    const { createJob } = await import("@/src/domain/jobs")
    const job = await createJob(user, {
      brief: "History of the tea trade",
      instructions: "Cite primary sources. Keep it short.",
    })
    expect(job.instructions).toBe("Cite primary sources. Keep it short.")
    expect(job.domain).toBe("general")
    expect(job.budgetCents).toBe(2000)
    await expect(
      applyGrokBotMemo(hex(job._id), { markdown: "nope" })
    ).rejects.toMatchObject({ code: "forbidden" })
  })
})
