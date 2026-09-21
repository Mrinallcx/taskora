import { createServer } from "node:http"

import { loadLocalEnv } from "../src/lib/load-env"

loadLocalEnv()

const BASE = (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "")
const AUTH = "Bearer test:grok-bot-local"

async function json(path: string, init: RequestInit = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      authorization: AUTH,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  })
  const text = await response.text()
  let body: unknown = text
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { ok: response.ok, status: response.status, body }
}

function startMockBot() {
  const server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk) => chunks.push(chunk as Buffer))
    req.on("end", () => {
      let payload: { brief?: string; callbackUrl?: string } = {}
      try {
        payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as typeof payload
      } catch {
        payload = {}
      }
      const markdown = [
        "# MEMO: Grok Bot local mock",
        "",
        "This is **not** the Grok Bot app. It is a local stand-in that proves Taskora can ping a webhook and show the returned memo.",
        "",
        `Brief: ${payload.brief ?? ""}`,
        "",
        "## What a sourced desk does",
        "- Lock a brief and a budget",
        "- Store pages from this job",
        "- Quote those pages in the memo",
        "- Grade the work on someone who did not write it",
      ].join("\n")
      const finish = (callbackStatus = 0) => {
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ runId: "local-mock", callbackStatus }))
      }
      if (!payload.callbackUrl) {
        finish()
        return
      }
      void fetch(payload.callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown }),
      })
        .then((callback) => finish(callback.status))
        .catch(() => finish(0))
    })
  })
  return new Promise<{ url: string; close: () => Promise<void> }>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        reject(new Error("mock bot failed to bind"))
        return
      }
      resolve({
        url: `http://127.0.0.1:${address.port}/`,
        close: () =>
          new Promise((done, fail) =>
            server.close((error) => (error ? fail(error) : done()))
          ),
      })
    })
  })
}

async function main() {
  const health = await json("/api/health")
  if (!health.ok) {
    throw new Error(
      `Taskora is not up at ${BASE}. Start it with pnpm dev, then rerun.`
    )
  }

  const mock = await startMockBot()
  console.log("1. local mock Grok webhook listening")

  const created = await json("/api/test/grok-bot", {
    method: "POST",
    body: JSON.stringify({
      brief:
        "In 6 bullet points, what is a sourced research desk versus a chatbot?",
      webhookUrl: mock.url,
    }),
  })
  if (!created.ok) {
    throw new Error(`create failed ${created.status} ${JSON.stringify(created.body)}`)
  }
  const row = created.body as {
    id: string
    ping: { pinged: boolean; reason: string; status: number }
    dashboardPath: string
  }
  console.log(
    `2. posted Taskora job ${row.id} ping=${row.ping.pinged} reason=${row.ping.reason}`
  )
  if (!row.ping.pinged) {
    throw new Error("local mock webhook was not pinged")
  }

  let memo = ""
  for (let i = 0; i < 20; i += 1) {
    const job = await json(`/api/jobs/${row.id}`)
    const payload = job.body as {
      job?: { status?: string }
      artifacts?: { markdown?: string; payload?: { markdown?: string } }[]
    }
    const artifact = payload.artifacts?.at(-1)
    memo = String(artifact?.payload?.markdown ?? artifact?.markdown ?? "")
    if (payload.job?.status === "delivered" && memo) break
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  await mock.close()

  if (!memo.includes("Grok Bot local mock")) {
    throw new Error("memo did not land on the Taskora job")
  }
  console.log(`3. memo on Taskora (${memo.length} chars)`)
  console.log(`   open ${BASE}${row.dashboardPath}`)

  const liveUrl = process.env.GROK_BOT_WEBHOOK_URL?.trim()
  if (!liveUrl) {
    console.log(
      "4. real Grok Bot skipped — no GROK_BOT_WEBHOOK_URL. Local loop works; the installed app was not reachable from here."
    )
    return
  }

  const live = await json("/api/test/grok-bot", {
    method: "POST",
    body: JSON.stringify({
      brief: "Reply with one short paragraph: what is Taskora testing?",
    }),
  })
  const liveRow = live.body as {
    id?: string
    ping?: { pinged: boolean; reason: string; status: number }
  }
  console.log(
    `4. real Grok Bot pinged=${liveRow.ping?.pinged} status=${liveRow.ping?.status} reason=${liveRow.ping?.reason}`
  )
  if (!liveRow.ping?.pinged) {
    console.log("   webhook did not accept the ping. Job will stay empty.")
    return
  }
  console.log(
    `   waiting 20s for a callback on ${liveRow.id} (Grok Bot cloud cannot hit localhost unless you tunnel).`
  )
  const started = Date.now()
  while (Date.now() - started < 20_000) {
    const job = await json(`/api/jobs/${liveRow.id}`)
    const payload = job.body as {
      job?: { status?: string }
      artifacts?: { markdown?: string }[]
    }
    const text = payload.artifacts?.at(-1)?.markdown ?? ""
    if (payload.job?.status === "delivered" && text) {
      console.log(`   real callback landed (${text.length} chars)`)
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  console.log(
    "   no callback. Expected on local: Grok Bot can be pinged only if the webhook is set; it cannot POST back to localhost."
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
