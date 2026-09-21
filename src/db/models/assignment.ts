import { Schema, registered } from "./register"

const schema = new Schema(
  {
    taskId: { type: Schema.Types.ObjectId, required: true },
    jobId: { type: Schema.Types.ObjectId, required: true },
    listingId: { type: Schema.Types.ObjectId, required: true },
    ownerUserId: { type: String, required: true },
    role: { type: String, enum: ["lead", "worker", "evaluator"], required: true },
  },
  { timestamps: true, collection: "assignments" }
)

schema.index({ jobId: 1, role: 1 })

export const Assignment = registered("Assignment", schema)
