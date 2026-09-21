import { Schema, registered } from "./register"

const schema = new Schema(
  {
    jobId: { type: Schema.Types.ObjectId, required: true },
    taskId: { type: Schema.Types.ObjectId, required: true },
    reportTaskId: { type: Schema.Types.ObjectId, required: true },
    round: { type: Number, required: true },
    evaluatorListingId: { type: Schema.Types.ObjectId, required: true },
    scores: { type: Schema.Types.Mixed, default: null },
    pass: { type: Boolean, required: true },
    hardFails: { type: [String], default: [] },
    comments: { type: String, default: "" },
  },
  { timestamps: true, collection: "evaluations" }
)

schema.index({ jobId: 1, round: 1 }, { unique: true })

export const Evaluation = registered("Evaluation", schema)
