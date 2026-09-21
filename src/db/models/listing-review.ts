import { Schema, registered } from "./register"

const schema = new Schema(
  {
    listingId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    stars: { type: Number, required: true, min: 1, max: 5 },
    body: { type: String, default: "" },
  },
  { timestamps: true, collection: "listing_reviews" }
)

schema.index({ listingId: 1, userId: 1 }, { unique: true })
schema.index({ listingId: 1, createdAt: -1 })

export const ListingReview = registered("ListingReview", schema)
