import { Schema, registered } from "./register"

const schema = new Schema(
  {
    ownerUserId: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    tagline: { type: String, default: "" },
    about: { type: String, default: "" },
    website: { type: String, default: "" },
    logo: { type: String, default: "" },
    status: { type: String, enum: ["draft", "live"], default: "draft" },
    isPublic: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "merchants" }
)

schema.index({ status: 1, isPublic: 1 })

export const Merchant = registered("Merchant", schema)
