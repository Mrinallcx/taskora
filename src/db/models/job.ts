import { Schema, registered } from "./register"

const schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    clerkUserId: { type: String, required: true },
    domain: {
      type: String,
      enum: ["general", "finance", "academic", "news"],
      required: true,
    },
    brief: { type: String, required: true },
    name: { type: String, default: "" },
    instructions: { type: String, default: "" },
    category: { type: String, default: "" },
    symbol: { type: String, default: "" },
    companyName: { type: String, default: "" },
    exchange: { type: String, default: "" },
    symbols: {
      type: [
        {
          symbol: { type: String, required: true },
          name: { type: String, default: "" },
          exchange: { type: String, default: "NASDAQ" },
        },
      ],
      default: [],
    },
    status: { type: String, required: true, default: "draft" },
    budgetCents: { type: Number, required: true },
    computeBudgetCents: { type: Number, default: 500 },
    computeSpentCents: { type: Number, default: 0 },
    escrowCents: { type: Number, default: 0 },
    planId: { type: Schema.Types.ObjectId },
    evalPolicy: {
      independentRequired: { type: Boolean, default: true },
      minEvaluators: { type: Number, default: 1 },
      disputeHours: { type: Number, default: 24 },
    },
    caps: {
      maxSearches: { type: Number, default: 12 },
      maxFetches: { type: Number, default: 24 },
      maxDomainCalls: { type: Number, default: 20 },
      maxRevisions: { type: Number, default: 2 },
      maxHireDepth: { type: Number, default: 1 },
    },
    revisionsUsed: { type: Number, default: 0 },
    useUserSearch: { type: Boolean, default: false },
    useUserPrices: { type: Boolean, default: false },
    useAppIds: { type: [String], default: [] },
    fallbackToPlatform: { type: Boolean, default: false },
    listingId: { type: Schema.Types.ObjectId },
    isPublic: { type: Boolean, default: false },
    underMerchant: { type: Boolean, default: false },
    autoApprovePlan: { type: Boolean, default: false },
    emailOnDeliver: { type: Boolean, default: false },
    notifyEmail: { type: String, default: "" },
    deliveredEmailAt: { type: Date },
    planSubmittedAt: { type: Date },
    deliveredAt: { type: Date },
    cancelReason: { type: String },
    workerId: { type: String, default: "" },
    workerQueued: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "jobs" }
)

schema.index({ userId: 1, status: 1 })
schema.index({ status: 1, deliveredAt: 1 })
schema.index({ status: 1, planSubmittedAt: 1 })
schema.index({ workerId: 1, status: 1 })
schema.index({ workerQueued: 1, createdAt: 1 })

export const Job = registered("Job", schema)
