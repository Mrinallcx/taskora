import mongoose from "mongoose"

const g = globalThis as unknown as {
  _mongoose?: Promise<typeof mongoose>
  _mongooseUri?: string
}

export async function connect() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error("MONGODB_URI is not set")
  }
  if (g._mongooseUri !== uri) {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect()
    }
    g._mongoose = undefined
    g._mongooseUri = uri
  }
  g._mongoose ??= mongoose.connect(uri)
  return g._mongoose
}

export async function withSession<T>(
  fn: (session: mongoose.ClientSession | null) => Promise<T>
): Promise<T> {
  await connect()
  try {
    const session = await mongoose.startSession()
    try {
      let result!: T
      await session.withTransaction(async () => {
        result = await fn(session)
      })
      return result
    } finally {
      await session.endSession()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes("Transaction numbers are only allowed")) {
      return fn(null)
    }
    throw error
  }
}

export function sessionOpts(session: mongoose.ClientSession | null) {
  return session ? { session } : {}
}

export async function disconnect() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
  g._mongoose = undefined
  g._mongooseUri = undefined
}
