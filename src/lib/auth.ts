import { auth } from "@clerk/nextjs/server"
import { currentUser } from "@clerk/nextjs/server"

import { connect } from "@/src/db/connect"
import { User } from "@/src/db/models"
import { ApiError } from "@/src/domain/errors"

function testClerkUserId(request?: Request) {
  if (process.env.NODE_ENV === "production") return null
  if (process.env.ALLOW_TEST_AUTH !== "1") return null
  const header = request?.headers.get("authorization") ?? ""
  if (!header.startsWith("Bearer test:")) return null
  return header.slice("Bearer test:".length)
}

export async function getSessionUser(request?: Request) {
  await connect()
  const testId = testClerkUserId(request)
  let clerkUserId = testId
  let email = ""
  let displayName = ""

  if (!clerkUserId) {
    const session = await auth()
    clerkUserId = session.userId
    if (clerkUserId) {
      const user = await currentUser()
      email = user?.primaryEmailAddress?.emailAddress ?? ""
      displayName = user?.fullName ?? user?.username ?? ""
    }
  }

  if (!clerkUserId) {
    throw new ApiError("unauthorized", "Sign in required", 401)
  }

  const $set: { email?: string; displayName?: string } = {}
  if (email) $set.email = email
  if (displayName) $set.displayName = displayName

  const user = await User.findOneAndUpdate(
    { clerkUserId },
    {
      ...(Object.keys($set).length > 0 ? { $set } : {}),
      $setOnInsert: {
        availableCents: 100000,
        escrowedCents: 0,
      },
    },
    { upsert: true, returnDocument: "after" }
  )
  if (!user) {
    throw new ApiError("unauthorized", "Sign in required", 401)
  }
  return user
}

export function workerAuthorized(request: Request) {
  const expected = process.env.WORKER_SECRET
  const header = request.headers.get("authorization") ?? ""
  return Boolean(expected) && header === `Bearer ${expected}`
}
