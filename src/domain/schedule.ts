export type ScheduleCadence = "off" | "daily" | "weekly" | "monthly"

export type ScheduleListing = {
  scheduleCadence?: string
  scheduleTime?: string
  scheduleWeekday?: number
  scheduleMonthDay?: number
  scheduleTimezone?: string
  lastScheduledAt?: Date | null
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function parseClock(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim())
  if (!match) return { hours: 9, minutes: 0 }
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return { hours: 9, minutes: 0 }
  return { hours, minutes }
}

function zonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  )
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAYS.indexOf(parts.weekday),
  }
}

function periodKey(cadence: ScheduleCadence, parts: ReturnType<typeof zonedParts>) {
  if (cadence === "daily") return `${parts.year}-${parts.month}-${parts.day}`
  if (cadence === "weekly") {
    const start = Date.UTC(parts.year, parts.month - 1, parts.day - parts.weekday)
    return `w-${start}`
  }
  return `${parts.year}-${parts.month}`
}

export function isScheduleDue(listing: ScheduleListing, now = new Date()) {
  const cadence = listing.scheduleCadence
  if (cadence !== "daily" && cadence !== "weekly" && cadence !== "monthly") {
    return false
  }
  const timeZone = listing.scheduleTimezone || "UTC"
  const nowParts = zonedParts(now, timeZone)
  const { hours, minutes } = parseClock(listing.scheduleTime || "09:00")
  if (cadence === "weekly" && nowParts.weekday !== (listing.scheduleWeekday ?? 1)) {
    return false
  }
  if (cadence === "monthly" && nowParts.day !== (listing.scheduleMonthDay ?? 1)) {
    return false
  }
  if (nowParts.hour < hours || (nowParts.hour === hours && nowParts.minute < minutes)) {
    return false
  }
  if (listing.lastScheduledAt) {
    const last = zonedParts(listing.lastScheduledAt, timeZone)
    if (periodKey(cadence, last) === periodKey(cadence, nowParts)) return false
  }
  return true
}
