import mongoose from "mongoose"

import { PLATFORM_LISTINGS } from "@/src/domain/platform-seed"
import { loadLocalEnv } from "@/src/lib/load-env"

const SKIP = new Set(["user_credentials"])

function argValue(flag: string) {
  const index = process.argv.indexOf(flag)
  if (index < 0) return ""
  return (process.argv[index + 1] ?? "").trim()
}

function hostOf(uri: string) {
  try {
    return new URL(uri.replace("mongodb+srv", "https").replace("mongodb", "http"))
      .host
  } catch {
    return "(unparsed host)"
  }
}

async function main() {
  loadLocalEnv()
  const sourceUri = (process.env.MONGODB_URI ?? "").trim()
  const targetUri = (
    argValue("--to") ||
    process.env.TARGET_MONGODB_URI ||
    process.env.MONGODB_ATLAS_URI ||
    ""
  ).trim()
  const copyAll = process.argv.includes("--all")

  if (!sourceUri) {
    throw new Error("MONGODB_URI is not set")
  }
  if (!targetUri) {
    throw new Error(
      "Pass the production URI: pnpm db:push -- --to 'mongodb+srv://...'"
    )
  }
  if (targetUri === sourceUri) {
    throw new Error("Target URI is the same as local MONGODB_URI")
  }

  const source = await mongoose.createConnection(sourceUri).asPromise()
  const target = await mongoose.createConnection(targetUri).asPromise()
  if (!source.db || !target.db) {
    throw new Error("Could not open a Mongo database on source or target")
  }

  let listingCount = 0
  for (const row of PLATFORM_LISTINGS) {
    await target.db.collection("agent_listings").updateOne(
      { slug: row.slug },
      {
        $set: { ...row, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    )
    listingCount += 1
  }

  let copied = 0
  if (copyAll) {
    const names = (await source.db.listCollections().toArray()).map((row) => row.name)
    for (const name of names) {
      if (SKIP.has(name)) continue
      const docs = await source.db.collection(name).find().toArray()
      if (docs.length === 0) continue
      await target.db.collection(name).bulkWrite(
        docs.map((doc) => ({
          replaceOne: {
            filter: { _id: doc._id },
            replacement: doc,
            upsert: true,
          },
        }))
      )
      copied += docs.length
    }
  }

  await source.close()
  await target.close()
  console.log(
    copyAll
      ? `Imported ${listingCount} platform listings and ${copied} documents to ${hostOf(targetUri)}`
      : `Imported ${listingCount} platform listings to ${hostOf(targetUri)}`
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
