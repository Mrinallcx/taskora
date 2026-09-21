import { ApiError } from "@/src/domain/errors"

const LOGO_MAX = 350_000
const LOGO_DATA = /^data:image\/(png|jpeg|webp);base64,/i

export function slugifyBrand(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
  return base || "brand"
}

export function parseWebsite(raw: string) {
  const value = raw.trim()
  if (!value) return ""
  let parsed: URL
  try {
    parsed = new URL(value.includes("://") ? value : `https://${value}`)
  } catch {
    throw new ApiError("invalid", "Website must be a valid URL", 400)
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ApiError("invalid", "Website must be http or https", 400)
  }
  return parsed.toString()
}

export function parseLogo(raw: string) {
  const value = raw.trim()
  if (!value) return ""
  if (value.startsWith("data:")) {
    if (!LOGO_DATA.test(value) || value.length > LOGO_MAX) {
      throw new ApiError(
        "invalid",
        "Logo must be a PNG, JPEG, or WebP under 250 KB",
        400
      )
    }
    return value
  }
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new ApiError("invalid", "Logo must be an image file or URL", 400)
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ApiError("invalid", "Logo URL must be http or https", 400)
  }
  return parsed.toString()
}

export function serializeMerchant(row: {
  _id: { toString(): string }
  slug: string
  name: string
  tagline?: string
  about?: string
  website?: string
  logo?: string
  status: string
  isPublic: boolean
}) {
  return {
    id: String(row._id),
    slug: row.slug,
    name: row.name,
    tagline: row.tagline || "",
    about: row.about || "",
    website: row.website || "",
    logo: row.logo || "",
    status: row.status === "live" ? "live" : "draft",
    isPublic: Boolean(row.isPublic),
  }
}
