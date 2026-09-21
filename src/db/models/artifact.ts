import { Schema, registered } from "./register"

const citation = new Schema(
  {
    snapshotId: String,
    url: String,
    quote: String,
    sourceClass: String,
    doi: String,
    arxivId: String,
    accession: String,
  },
  { _id: false }
)

const schema = new Schema(
  {
    taskId: { type: Schema.Types.ObjectId, required: true },
    jobId: { type: Schema.Types.ObjectId, required: true },
    round: { type: Number, default: 0 },
    attempt: { type: Number, default: 1 },
    markdown: { type: String, default: "" },
    payload: { type: Schema.Types.Mixed, default: {} },
    citations: { type: [citation], default: [] },
  },
  { timestamps: true, collection: "artifacts" }
)

schema.index({ taskId: 1, round: 1, attempt: 1 })

export const Artifact = registered("Artifact", schema)
