const { MongoClient } = require("mongodb")

async function main() {
  const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017"
  const client = new MongoClient(uri)
  await client.connect()
  try {
    await client.db("admin").command({
      replSetInitiate: {
        _id: "rs0",
        members: [{ _id: 0, host: "127.0.0.1:27017" }],
      },
    })
    console.log("Replica set rs0 initiated")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes("already initialized")) {
      console.log("Replica set already initialized")
    } else {
      throw error
    }
  } finally {
    await client.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
