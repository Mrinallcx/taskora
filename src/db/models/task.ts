import { Schema, registered } from "./register"

const schema = new Schema(
  {
    jobId: { type: Schema.Types.ObjectId, required: true },
    type: {
      type: String,
      enum: ["plan", "scope", "sources", "findings", "report", "evaluate"],
      required: true,
    },
    status: { type: String, required: true, default: "created" },
    listingId: { type: Schema.Types.ObjectId, required: true },
    attempt: { type: Number, default: 1 },
    lockedAt: { type: Date },
    lockedBy: { type: String },
    timeoutMs: { type: Number, required: true },
  },
  { timestamps: true, collection: "tasks" }
)

schema.index({ jobId: 1, type: 1 })
schema.index({ status: 1, createdAt: 1 })
schema.index({ status: 1, lockedAt: 1 })

export const Task = registered("Task", schema)
