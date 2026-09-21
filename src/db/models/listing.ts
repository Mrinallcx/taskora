import { Schema, registered } from "./register"

const schema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    kind: { type: String, enum: ["lead", "worker", "evaluator"], required: true },
    ownerUserId: { type: String, required: true },
    vertical: { type: String, default: "research" },
    priceCents: { type: Number, required: true },
    runtime: { type: String, default: "hosted_prompt" },
    status: { type: String, enum: ["live", "paused"], default: "live" },
    name: { type: String, default: "" },
    summary: { type: String, default: "" },
    skills: { type: String, default: "" },
    prompt: { type: String, default: "" },
    tools: { type: [String], default: [] },
    isPublic: { type: Boolean, default: false },
    underMerchant: { type: Boolean, default: false },
    defaultBrief: { type: String, default: "" },
    runImmediately: { type: Boolean, default: false },
    scheduleCadence: {
      type: String,
      enum: ["off", "daily", "weekly", "monthly"],
      default: "off",
    },
    scheduleTime: { type: String, default: "09:00" },
    scheduleWeekday: { type: Number, default: 1 },
    scheduleMonthDay: { type: Number, default: 1 },
    scheduleTimezone: { type: String, default: "UTC" },
    lastScheduledAt: { type: Date },
    emailOnDeliver: { type: Boolean, default: false },
    notifyEmail: { type: String, default: "" },
    useUserSearch: { type: Boolean, default: false },
    useUserPrices: { type: Boolean, default: false },
    useAppIds: { type: [String], default: [] },
    providers: {
      type: [
        {
          name: String,
          endpoints: [String],
          last4: String,
          iv: String,
          tag: String,
          ciphertext: String,
        },
      ],
      default: [],
    },
  },
  { timestamps: true, collection: "agent_listings" }
)

schema.index({ status: 1, scheduleCadence: 1 })

export const Listing = registered("Listing", schema)
