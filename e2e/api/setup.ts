import { MongoMemoryReplSet } from "mongodb-memory-server"

import { connect, disconnect } from "@/src/db/connect"
import { seedListings } from "@/scripts/seed"

let replset: MongoMemoryReplSet | undefined

export async function startTestMongo() {
  process.env.AGENT_PROVIDER = "fake"
  process.env.TOOL_PROVIDER = "fake"
  process.env.ALLOW_TEST_AUTH = "1"
  process.env.WORKER_IN_PROCESS = "1"
  process.env.WORKER_SECRET = "test-worker"
  process.env.ENCRYPTION_KEY =
    process.env.ENCRYPTION_KEY ||
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  process.env.FAKE_LEAD = "default"
  process.env.FAKE_EVAL = "pass"
  await disconnect()
  replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
  process.env.MONGODB_URI = replset.getUri("multiagent")
  await connect()
  await seedListings()
}

export async function stopTestMongo() {
  await disconnect()
  await replset?.stop()
  replset = undefined
}
