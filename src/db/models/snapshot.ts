import { Schema, registered } from "./register"

const schema = new Schema(
  {
    jobId: { type: Schema.Types.ObjectId, required: true },
    url: { type: String, required: true },
    retrievedAt: { type: Date, default: Date.now },
    text: { type: String, required: true },
    sha256: { type: String, required: true },
    toolName: { type: String, required: true },
  },
  { timestamps: true, collection: "source_snapshots" }
)

schema.index({ jobId: 1, url: 1 }, { unique: true })

export const Snapshot = registered("Snapshot", schema)
