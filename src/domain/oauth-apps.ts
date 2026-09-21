import { createHash, createHmac, randomBytes } from "node:crypto"

import { encryptSecret } from "@/src/crypto/secrets"
import { ApiError } from "@/src/domain/errors"

const COOKIE = "taskora_oauth"
const STATE_TTL_MS = 10 * 60 * 1000

type OAuthProvider = {
  id: "box"
  authorizeUrl: string
  tokenUrl: string
  scopes: string
  clientId: string
  clientSecret: string
}

type OAuthState = {
  userId: string
  appId: string
  verifier: string
  provider: "box"
  exp: number
}

function signingKey() {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new ApiError("invalid", "Server encryption is not configured", 500)
  }
  return Buffer.from(hex, "hex")
}

function b64url(value: Buffer) {
  return value.toString("base64url")
}

export function oauthCookieName() {
  return COOKIE
}

export function oauthRedirectUri() {
  const base = (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  )
  return `${base}/api/apps/oauth/callback`
}

export function oauthProviderForUrl(url: string): OAuthProvider | null {
  let host = ""
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
  const isBox = host === "mcp.box.com" || host.endsWith(".box.com")
  if (!isBox) return null
  const clientId = process.env.BOX_CLIENT_ID?.trim() ?? ""
  const clientSecret = process.env.BOX_CLIENT_SECRET?.trim() ?? ""
  if (!clientId || !clientSecret) {
    throw new ApiError(
      "invalid",
      "Box sign-in is not set up on this server yet. Add BOX_CLIENT_ID and BOX_CLIENT_SECRET, then try Connect again.",
      400
    )
  }
  return {
    id: "box",
    authorizeUrl: "https://account.box.com/api/oauth2/authorize",
    tokenUrl: "https://api.box.com/oauth2/token",
    scopes: "root_readwrite ai.readwrite",
    clientId,
    clientSecret,
  }
}

export function createPkce() {
  const verifier = b64url(randomBytes(32))
  const challenge = b64url(createHash("sha256").update(verifier).digest())
  return { verifier, challenge }
}

export function packOauthState(payload: OAuthState) {
  const body = b64url(Buffer.from(JSON.stringify(payload)))
  const sig = createHmac("sha256", signingKey()).update(body).digest("base64url")
  return `${body}.${sig}`
}

export function unpackOauthState(raw: string | undefined): OAuthState {
  if (!raw || !raw.includes(".")) {
    throw new ApiError("invalid", "OAuth state is missing", 400)
  }
  const [body, sig] = raw.split(".")
  const expected = createHmac("sha256", signingKey())
    .update(body)
    .digest("base64url")
  if (expected.length !== sig.length || expected !== sig) {
    throw new ApiError("invalid", "OAuth state is invalid", 400)
  }
  const payload = JSON.parse(
    Buffer.from(body, "base64url").toString("utf8")
  ) as OAuthState
  if (!payload?.userId || !payload.appId || !payload.verifier) {
    throw new ApiError("invalid", "OAuth state is invalid", 400)
  }
  if (payload.exp < Date.now()) {
    throw new ApiError("invalid", "OAuth sign-in expired. Try Connect again.", 400)
  }
  return payload
}

export function oauthAuthorizeUrl(input: {
  provider: OAuthProvider
  state: string
  challenge: string
}) {
  const url = new URL(input.provider.authorizeUrl)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", input.provider.clientId)
  url.searchParams.set("redirect_uri", oauthRedirectUri())
  url.searchParams.set("scope", input.provider.scopes)
  url.searchParams.set("state", input.state)
  url.searchParams.set("code_challenge", input.challenge)
  url.searchParams.set("code_challenge_method", "S256")
  return url.toString()
}

export async function exchangeOauthCode(input: {
  provider: OAuthProvider
  code: string
  verifier: string
}) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    client_id: input.provider.clientId,
    client_secret: input.provider.clientSecret,
    redirect_uri: oauthRedirectUri(),
    code_verifier: input.verifier,
  })
  const response = await fetch(input.provider.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  const json = (await response.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }
  if (!response.ok || !json.access_token) {
    throw new ApiError(
      "credential_error",
      json.error_description || json.error || "Box did not return a token",
      400
    )
  }
  const packed = encryptSecret(
    JSON.stringify({
      access_token: json.access_token,
      refresh_token: json.refresh_token ?? "",
      expires_at: Date.now() + Number(json.expires_in ?? 3600) * 1000,
    })
  )
  return {
    ...packed,
    last4: json.access_token.slice(-4),
  }
}

export function newOauthState(input: {
  userId: string
  appId: string
  verifier: string
  provider: "box"
}) {
  return {
    ...input,
    exp: Date.now() + STATE_TTL_MS,
  }
}
