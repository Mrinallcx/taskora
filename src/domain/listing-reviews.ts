import { Listing, ListingReview, User } from "@/src/db/models"
import { connect } from "@/src/db/connect"
import { ApiError } from "@/src/domain/errors"
import { asObjectId, hex } from "@/src/lib/ids"

export type ListingReviewRow = {
  id: string
  stars: number
  body: string
  at: string
  name: string
  mine: boolean
}

export type ListingReviewSummary = {
  average: number
  count: number
  mine: { stars: number; body: string } | null
  reviews: ListingReviewRow[]
}

const DUMMY_REVIEWS: ListingReviewRow[] = [
  {
    id: "dummy-1",
    stars: 5,
    body: "Hired this agent for a sourced memo. Plan was clear and the worker it picked actually cited pages.",
    at: "",
    name: "Priya M.",
    mine: false,
  },
  {
    id: "dummy-2",
    stars: 4,
    body: "Solid on structure. One figure was off until I checked the source, but the rest of the brief was covered.",
    at: "",
    name: "James K.",
    mine: false,
  },
  {
    id: "dummy-3",
    stars: 5,
    body: "Fast hire, readable memo. Would run another task with the same agent.",
    at: "",
    name: "Amelia R.",
    mine: false,
  },
]

function roundAverage(total: number, count: number) {
  if (count === 0) return 0
  return Math.round((total / count) * 10) / 10
}

export async function reviewsForListing(listingId: string, viewerUserId: string) {
  await connect()
  const id = asObjectId(listingId)
  if (!id) throw new ApiError("not_found", "Agent not found", 404)
  const listing = await Listing.findById(id)
  if (!listing) throw new ApiError("not_found", "Agent not found", 404)

  const rows = await ListingReview.find({ listingId: hex(listing._id) }).sort({
    createdAt: -1,
  })
  const users = await User.find({
    _id: {
      $in: rows.map((row) => asObjectId(row.userId)).filter(Boolean),
    },
  }).select("displayName")
  const names = new Map(
    users.map((user) => [hex(user._id), user.displayName || "Reviewer"])
  )
  let total = 0
  let mine: ListingReviewSummary["mine"] = null
  const reviews: ListingReviewRow[] = [
    ...rows.map((row) => {
      total += row.stars
      const mineRow = row.userId === viewerUserId
      if (mineRow) mine = { stars: row.stars, body: row.body || "" }
      return {
        id: hex(row._id),
        stars: row.stars,
        body: row.body || "",
        at: (row as { createdAt?: Date }).createdAt
          ? new Date((row as { createdAt: Date }).createdAt).toISOString()
          : "",
        name: mineRow ? "You" : names.get(row.userId) || "Reviewer",
        mine: mineRow,
      }
    }),
    ...DUMMY_REVIEWS,
  ]
  for (const dummy of DUMMY_REVIEWS) total += dummy.stars
  const count = reviews.length
  return {
    average: roundAverage(total, count),
    count,
    mine,
    reviews,
  } satisfies ListingReviewSummary
}

export async function upsertListingReview(
  listingId: string,
  userId: string,
  input: { stars: number; body?: string }
) {
  await connect()
  const id = asObjectId(listingId)
  if (!id) throw new ApiError("not_found", "Agent not found", 404)
  const listing = await Listing.findById(id)
  if (!listing) throw new ApiError("not_found", "Agent not found", 404)
  const stars = Math.round(input.stars)
  if (stars < 1 || stars > 5) {
    throw new ApiError("invalid", "Pick a rating from 1 to 5")
  }
  const body = (input.body ?? "").trim()
  if (body.length > 800) {
    throw new ApiError("invalid", "Review must be under 800 characters")
  }
  await ListingReview.findOneAndUpdate(
    { listingId: hex(listing._id), userId },
    { listingId: hex(listing._id), userId, stars, body },
    { upsert: true }
  )
  return reviewsForListing(listingId, userId)
}
