import { Schema, registered } from "./register"

const schema = new Schema(
  {
    jobId: { type: Schema.Types.ObjectId, required: true, index: true },
    tasks: { type: [{}], default: [] },
    proposedListingSlugs: { type: [String], default: [] },
    estimatedCostCents: { type: Number, required: true },
    questions: { type: [String], default: [] },
    approvedAt: { type: Date },
  },
  { timestamps: true, collection: "job_plans" }
)

export const JobPlan = registered("JobPlan", schema)
