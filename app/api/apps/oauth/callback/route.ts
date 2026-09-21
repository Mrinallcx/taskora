import { NextResponse } from "next/server"
import { cookies } from "next/headers"

import { connect } from "@/src/db/connect"
import { UserApp } from "@/src/db/models"
import { getSessionUser } from "@/src/lib/auth"
import { asObjectId, hex } from "@/src/lib/ids"
import {
  exchangeOauthCode,
  oauthCookieName,
  oauthProviderForUrl,
  unpackOauthState,
} from "@/src/domain/oauth-apps"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function appsRedirect(query: string) {
  const base = (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  )
  return NextResponse.redirect(`${base}/apps?tab=mine&${query}`)
}

export async function GET(request: Request) {
  const jar = await cookies()
  try {
    const user = await getSessionUser(request)
    const url = new URL(request.url)
    const error = url.searchParams.get("error")
    if (error) {
      jar.delete(oauthCookieName())
      return appsRedirect("oauth=error")
    }
    const code = url.searchParams.get("code") ?? ""
    const stateParam = url.searchParams.get("state") ?? ""
    const cookieState = jar.get(oauthCookieName())?.value ?? ""
    if (!code || !stateParam || stateParam !== cookieState) {
      jar.delete(oauthCookieName())
      return appsRedirect("oauth=error")
    }
    const state = unpackOauthState(cookieState)
    if (state.userId !== hex(user._id)) {
      jar.delete(oauthCookieName())
      return appsRedirect("oauth=error")
    }
    const id = asObjectId(state.appId)
    if (!id) return appsRedirect("oauth=error")
    await connect()
    const app = await UserApp.findOne({ _id: id, userId: user._id })
    if (!app) return appsRedirect("oauth=error")
    const provider = oauthProviderForUrl(app.url)
    if (!provider || provider.id !== state.provider) {
      return appsRedirect("oauth=error")
    }
    const packed = await exchangeOauthCode({
      provider,
      code,
      verifier: state.verifier,
    })
    app.status = "ready"
    app.iv = packed.iv
    app.tag = packed.tag
    app.ciphertext = packed.ciphertext
    app.last4 = packed.last4
    await app.save()
    jar.delete(oauthCookieName())
    return appsRedirect("oauth=connected")
  } catch {
    jar.delete(oauthCookieName())
    return appsRedirect("oauth=error")
  }
}
