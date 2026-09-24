import { redirect } from "next/navigation"
import { SignIn } from "@clerk/nextjs"

import { authDisabled } from "@/src/lib/auth-flag"

export default function SignInPage() {
  if (authDisabled()) redirect("/dashboard")
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <SignIn />
    </div>
  )
}
