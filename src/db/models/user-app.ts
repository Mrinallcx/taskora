import { Schema, registered } from "./register"

const schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    auth: { type: String, enum: ["oauth", "apikey", "open"], required: true },
    category: { type: String, default: "other" },
    maintainer: { type: String, default: "" },
    headerName: { type: String, default: "Authorization" },
    custom: { type: Boolean, default: false },
    iv: { type: String, default: "" },
    tag: { type: String, default: "" },
    ciphertext: { type: String, default: "" },
    last4: { type: String, default: "" },
    status: {
      type: String,
      enum: ["ready", "needs_auth"],
      default: "ready",
    },
  },
  { timestamps: true, collection: "user_apps" }
)

schema.index({ userId: 1, url: 1 }, { unique: true })

export const UserApp = registered("UserApp", schema)
