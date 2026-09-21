import { Schema, registered } from "./register"

const schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: ["web_search", "prices"], required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    ciphertext: { type: String, required: true },
    last4: { type: String, required: true },
  },
  { timestamps: true, collection: "user_credentials" }
)

schema.index({ userId: 1, kind: 1 }, { unique: true })

export const Credential = registered("Credential", schema)
