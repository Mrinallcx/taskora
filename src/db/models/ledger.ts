import { Schema, registered } from "./register"

const schema = new Schema(
  {
    jobId: { type: Schema.Types.ObjectId, required: true },
    payeeUserId: { type: String, required: true },
    role: {
      type: String,
      enum: ["lead", "worker", "evaluator", "platform_fee", "user_refund"],
      required: true,
    },
    listingId: { type: Schema.Types.ObjectId },
    cents: { type: Number, required: true },
    idempotencyKey: { type: String, required: true, unique: true },
  },
  { timestamps: true, collection: "ledger_entries" }
)

export const Ledger = registered("Ledger", schema)
