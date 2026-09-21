import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { User } from "@/src/db/models"
import { createJob, fundJob, stopJob } from "@/src/domain/jobs"
import { getSessionUser } from "@/src/lib/auth"
import { hex } from "@/src/lib/ids"
import { startTestMongo, stopTestMongo } from "@/e2e/api/setup"

beforeAll(async () => {
  await startTestMongo()
})

afterAll(async () => {
  await stopTestMongo()
})

function req(clerkUserId: string) {
  return new Request("http://localhost/api/me", {
    headers: { authorization: `Bearer test:${clerkUserId}` },
  })
}

describe("P0 skeleton", () => {
  it("P0-API-01 me faucet, create, fund locks escrow", async () => {
    const user = await getSessionUser(req("p0-01"))
    expect(user.availableCents).toBe(100000)
    const job = await createJob(user, {
      brief: "History of tea trade last 20 years",
      domain: "general",
      budgetCents: 2000,
    })
    const funded = await fundJob(user._id, hex(job._id))
    expect(funded.status).toBe("planning")
    const fresh = await User.findById(user._id)
    expect(fresh?.availableCents).toBe(98000)
    expect(fresh?.escrowedCents).toBe(2000)
  })

  it("P0-API-03 stop refunds 100% before plan", async () => {
    const user = await getSessionUser(req("p0-03"))
    const job = await createJob(user, {
      brief: "How tea auctions work",
      domain: "general",
      budgetCents: 2000,
    })
    await fundJob(user._id, hex(job._id))
    await stopJob(user._id, hex(job._id))
    const fresh = await User.findById(user._id)
    expect(fresh?.escrowedCents).toBe(0)
    expect(fresh?.availableCents).toBe(100000)
  })

  it("P0-API-05 budget out of range", async () => {
    const user = await getSessionUser(req("p0-05"))
    await expect(
      createJob(user, { brief: "tea", domain: "general", budgetCents: 10 })
    ).rejects.toMatchObject({ code: "budget" })
  })

  it("P0-API-06 double fund is 409", async () => {
    const user = await getSessionUser(req("p0-06"))
    const job = await createJob(user, {
      brief: "tea markets overview",
      domain: "general",
      budgetCents: 2000,
    })
    await fundJob(user._id, hex(job._id))
    await expect(fundJob(user._id, hex(job._id))).rejects.toMatchObject({
      code: "conflict",
    })
  })

  it("P0-API-07 two sequential jobs both fund", async () => {
    const user = await getSessionUser(req("p0-07"))
    const a = await createJob(user, {
      brief: "first tea job",
      domain: "general",
      budgetCents: 2000,
    })
    const b = await createJob(user, {
      brief: "second tea job",
      domain: "general",
      budgetCents: 2000,
    })
    await fundJob(user._id, hex(a._id))
    await fundJob(user._id, hex(b._id))
    const fresh = await User.findById(user._id)
    expect(fresh?.escrowedCents).toBe(4000)
  })

  it("P0-API-08 denylist vs legitimate research", async () => {
    const user = await getSessionUser(req("p0-08"))
    await expect(
      createJob(user, {
        brief: "please insider-trading tips",
        domain: "general",
        budgetCents: 2000,
      })
    ).rejects.toMatchObject({ code: "denylist" })
    const ok = await createJob(user, {
      brief: "how insider trading rules evolved",
      domain: "general",
      budgetCents: 2000,
    })
    expect(ok.status).toBe("draft")
  })

  it("upserts a signed-in profile without Mongo path conflicts", async () => {
    const clerkUserId = "p0-email-upsert"
    const created = await User.findOneAndUpdate(
      { clerkUserId },
      {
        $set: { email: "ada@example.com", displayName: "Ada" },
        $setOnInsert: { availableCents: 100000, escrowedCents: 0 },
      },
      { upsert: true, returnDocument: "after" }
    )
    expect(created?.email).toBe("ada@example.com")
    const again = await getSessionUser(req(clerkUserId))
    expect(again.email).toBe("ada@example.com")
    expect(again.availableCents).toBe(100000)
  })

  it("P0-API-09 concurrent first requests one faucet", async () => {
    const [a, b] = await Promise.all([
      getSessionUser(req("p0-09")),
      getSessionUser(req("p0-09")),
    ])
    expect(hex(a._id)).toBe(hex(b._id))
    expect(a.availableCents).toBe(100000)
    const count = await User.countDocuments({ clerkUserId: "p0-09" })
    expect(count).toBe(1)
  })

  it("P0-DB-01 news domain rejected", async () => {
    const user = await getSessionUser(req("p0-db01"))
    await expect(
      createJob(user, { brief: "tea", domain: "news", budgetCents: 2000 })
    ).rejects.toMatchObject({ code: "invalid" })
  })

  it("P0-DB-02 fund more than available", async () => {
    const user = await getSessionUser(req("p0-db02"))
    user.availableCents = 100
    await user.save()
    const job = await createJob(user, {
      brief: "tea",
      domain: "general",
      budgetCents: 2000,
    })
    await expect(fundJob(user._id, hex(job._id))).rejects.toMatchObject({
      code: "budget",
    })
    const fresh = await User.findById(user._id)
    expect(fresh?.escrowedCents).toBe(0)
    expect(fresh?.availableCents).toBe(100)
  })
})
