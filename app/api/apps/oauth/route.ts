import { NextResponse } from "next/server"

import { connect } from "@/src/db/connect"
import { UserApp } from "@/src/db/models"
import { jsonError } from "@/src/lib/http"
import { getSessionUser } from "@/src/lib/auth"
import { asObjectId, hex } from "@/src/lib/ids"
import { ApiError } from "@/src/domain/errors"
import { rateLimit } from "@/src/domain/rate-limit"
import {
  createPkce,
  newOauthState,
  oauthAuthorizeUrl,
  oauthCookieName,
  oauthProviderForUrl,
  packOauthState,
} from "@/src/domain/oauth-apps"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request)
    if (!rateLimit(`apps-oauth:${user.clerkUserId}`, 20, 60 * 60 * 1000)) {
      throw new ApiError("rate_limited", "Too many sign-in attempts", 429)
    }
    const body = await request.json()
    const id = asObjectId(String(body.id ?? ""))
    if (!id) throw new ApiError("invalid", "App id required", 400)
    await connect()
    const app = await UserApp.findOne({ _id: id, userId: user._id })
    if (!app) throw new ApiError("not_found", "App not found", 404)
    if (app.auth !== "oauth") {
      throw new ApiError("invalid", "This app does not use OAuth", 400)
    }
    const provider = oauthProviderForUrl(app.url)
    if (!provider) {
      throw new ApiError(
        "invalid",
        `Sign-in for ${app.name} is not available yet.`,
        400
      )
    }
    const pkce = createPkce()
    const state = packOauthState(
      newOauthState({
        userId: hex(user._id),
        appId: hex(app._id),
        verifier: pkce.verifier,
        provider: provider.id,
      })
    )
    const response = NextResponse.json({
      url: oauthAuthorizeUrl({
        provider,
        state,
        challenge: pkce.challenge,
      }),
    })
    response.cookies.set(oauthCookieName(), state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60,
    })
    return response
  } catch (error) {
    return jsonError(error)
  }
}
