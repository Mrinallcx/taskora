import { describe, expect, it } from "vitest"

import { isScheduleDue } from "@/src/domain/schedule"

describe("isScheduleDue", () => {
  it("is due at the daily clock once", () => {
    const listing = {
      scheduleCadence: "daily",
      scheduleTime: "09:00",
      scheduleTimezone: "UTC",
    }
    expect(isScheduleDue(listing, new Date("2026-09-15T09:00:00Z"))).toBe(true)
    expect(
      isScheduleDue(
        { ...listing, lastScheduledAt: new Date("2026-09-15T09:00:00Z") },
        new Date("2026-09-15T09:05:00Z")
      )
    ).toBe(false)
    expect(isScheduleDue(listing, new Date("2026-09-15T08:59:00Z"))).toBe(false)
  })

  it("matches weekly weekday", () => {
    const listing = {
      scheduleCadence: "weekly",
      scheduleTime: "09:00",
      scheduleTimezone: "UTC",
      scheduleWeekday: 1,
    }
    expect(isScheduleDue(listing, new Date("2026-09-14T09:00:00Z"))).toBe(true)
    expect(isScheduleDue(listing, new Date("2026-09-15T09:00:00Z"))).toBe(false)
  })
})
