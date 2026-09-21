import { connect } from "@/src/db/connect"
import { Listing, User } from "@/src/db/models"
import { createJob, fundJob } from "@/src/domain/jobs"
import { ApiError } from "@/src/domain/errors"
import {
  budgetFromListing,
  domainFromListingTools,
} from "@/src/domain/listing-defaults"
import { isScheduleDue } from "@/src/domain/schedule"
import { hex } from "@/src/lib/ids"

export { budgetFromListing, domainFromListingTools }

export async function startListingJob(
  user: { _id: unknown; clerkUserId: string; email?: string },
  listing: InstanceType<typeof Listing>
) {
  const brief = String(listing.defaultBrief || listing.summary || "").trim()
  if (!brief) {
    throw new ApiError("invalid", "A brief is required to run this agent")
  }
  const job = await createJob(user, {
    brief,
    domain: domainFromListingTools(listing.tools ?? []),
    budgetCents: budgetFromListing(listing.priceCents ?? 0),
    listingId: listing._id,
    autoApprovePlan: true,
    emailOnDeliver: Boolean(listing.emailOnDeliver),
    notifyEmail: String(listing.notifyEmail || user.email || ""),
    useUserSearch: Boolean(listing.useUserSearch),
    useUserPrices: Boolean(listing.useUserPrices),
    useAppIds: Array.isArray(listing.useAppIds) ? listing.useAppIds : [],
  })
  await fundJob(user._id, hex(job._id))
  return job
}

export async function runDueListings() {
  await connect()
  const listings = await Listing.find({
    status: "live",
    kind: { $in: ["lead", "worker"] },
    scheduleCadence: { $in: ["daily", "weekly", "monthly"] },
    ownerUserId: { $ne: "platform" },
  })
  let started = 0
  for (const listing of listings) {
    if (!isScheduleDue(listing)) continue
    const user = await User.findById(listing.ownerUserId)
    if (!user) continue
    listing.lastScheduledAt = new Date()
    await listing.save()
    try {
      await startListingJob(user, listing)
      started += 1
    } catch (error) {
      console.error(`scheduled run failed for ${listing.slug}:`, error)
    }
  }
  return started
}
