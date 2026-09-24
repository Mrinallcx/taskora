import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { authDisabled } from "@/src/lib/auth-flag"

export async function requireUserId() {
  if (authDisabled()) return "guest-open"
  const { userId } = await auth()
  if (!userId) {
    redirect("/sign-in")
  }
  return userId
}
