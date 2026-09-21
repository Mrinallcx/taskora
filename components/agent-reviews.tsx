"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { StarIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { ListingReviewSummary } from "@/src/domain/listing-reviews"

function Stars({
  value,
  onPick,
  label,
}: {
  value: number
  onPick?: (stars: number) => void
  label?: string
}) {
  return (
    <div className="flex items-center gap-0.5" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value
        const icon = (
          <StarIcon
            className={
              filled
                ? "size-4 fill-amber-400 text-amber-400"
                : "size-4 text-amber-200/80 dark:text-amber-400/30"
            }
          />
        )
        if (!onPick) return <span key={star}>{icon}</span>
        return (
          <button
            key={star}
            type="button"
            className="rounded-sm p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
            onClick={() => onPick(star)}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
          >
            {icon}
          </button>
        )
      })}
    </div>
  )
}

export function AgentRatingSummary({
  average,
  count,
}: {
  average: number
  count: number
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Stars value={Math.round(average)} label={`${average} out of 5`} />
      <p className="text-muted-foreground text-sm">
        {count === 0
          ? "No ratings yet"
          : `${average.toFixed(1)} · ${count} ${count === 1 ? "rating" : "ratings"}`}
      </p>
    </div>
  )
}

export function AgentReviews({
  listingId,
  summary,
}: {
  listingId: string
  summary: ListingReviewSummary
}) {
  const router = useRouter()
  const [stars, setStars] = useState(summary.mine?.stars ?? 0)
  const [body, setBody] = useState(summary.mine?.body ?? "")
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setStars(summary.mine?.stars ?? 0)
    setBody(summary.mine?.body ?? "")
  }, [summary.mine?.stars, summary.mine?.body])

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (stars < 1) {
      toast.error("Pick a star rating first.")
      return
    }
    setPending(true)
    const response = await fetch(`/api/listings/${listingId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stars, body }),
    })
    const json = (await response.json().catch(() => ({}))) as {
      error?: { message?: string }
    }
    setPending(false)
    if (!response.ok) {
      toast.error(json.error?.message ?? "Could not save the review.")
      return
    }
    toast.success("Saved.")
    router.refresh()
  }

  return (
    <section className="flex flex-col gap-4 border-t pt-8">
      <p className="text-sm font-medium">Reviews</p>
      <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-3">
        <Stars value={stars} onPick={setStars} label="Your rating" />
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write a short review"
          rows={3}
          maxLength={800}
        />
        <div>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
      {summary.reviews.length === 0 ? (
        <p className="text-muted-foreground text-sm">No reviews yet.</p>
      ) : (
        <ul className="flex max-w-xl flex-col divide-y">
          {summary.reviews.map((review) => (
            <li key={review.id} className="flex flex-col gap-1 py-4 first:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <Stars value={review.stars} />
                <span className="text-muted-foreground text-sm">{review.name}</span>
              </div>
              {review.body ? (
                <p className="text-sm leading-relaxed">{review.body}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
