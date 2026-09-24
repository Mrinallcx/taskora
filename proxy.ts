import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

import { authDisabled } from "@/src/lib/auth-flag"

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/health",
])
const isInternal = createRouteMatcher([
  "/api/internal(.*)",
  "/api/jobs/:id/grok-complete",
])

export default clerkMiddleware(async (auth, req) => {
  if (authDisabled()) return NextResponse.next()
  const testAuth =
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_TEST_AUTH === "1" &&
    req.headers.get("authorization")?.startsWith("Bearer test:")
  if (testAuth) return NextResponse.next()
  if (isInternal(req)) return NextResponse.next()
  if (isPublicRoute(req)) return
  await auth.protect()
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
}
