import { Schema, registered } from "./register"

const schema = new Schema(
  {
    clerkUserId: { type: String, required: true, unique: true },
    email: { type: String, default: "" },
    displayName: { type: String, default: "" },
    availableCents: { type: Number, default: 100000 },
    escrowedCents: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "users" }
)

export const User = registered("User", schema)
