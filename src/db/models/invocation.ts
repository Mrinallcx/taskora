import { Schema, registered } from "./register"

const schema = new Schema(
  {
    jobId: { type: Schema.Types.ObjectId, required: true, index: true },
    taskId: { type: Schema.Types.ObjectId, required: true },
    tool: { type: String, required: true },
    argsHash: { type: String, default: "" },
    resultHash: { type: String, default: "" },
    tokens: { type: Number, default: 0 },
    costCents: { type: Number, required: true },
    credentialSource: {
      type: String,
      enum: ["platform", "user", "fallback"],
      default: "platform",
    },
  },
  { timestamps: true, collection: "tool_invocations" }
)

export const Invocation = registered("Invocation", schema)
