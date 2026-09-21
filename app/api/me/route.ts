import { NextResponse } from "next/server"

import { jsonError } from "@/src/lib/http"
import { getSessionUser } from "@/src/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request)
    return NextResponse.json({
      id: String(user._id),
      clerkUserId: user.clerkUserId,
      email: user.email,
      displayName: user.displayName,
      availableCents: user.availableCents,
      escrowedCents: user.escrowedCents,
    })
  } catch (error) {
    return jsonError(error)
  }
}
