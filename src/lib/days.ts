// Calendar days as YYYY-MM-DD in the store's time zone, the one the API groups reports and cash
// drawers by: a sale at 23:30 in the store belongs to that day wherever the browser is. Day
// arithmetic is done on UTC dates, so neither the browser's zone nor daylight saving shifts a day.

/**
 * The zone, once Intl accepts it. A misspelt zone fails here as the app loads, naming the setting,
 * instead of on every screen that shows a date.
 */
export function checkedTimeZone(zone: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
  } catch {
    throw new Error(`VITE_STORE_TIME_ZONE is not a valid IANA time zone: "${zone}"`)
  }
  return zone
}

// Must match the API's app.store.time-zone. Blank counts as unset.
export const STORE_TIME_ZONE = checkedTimeZone(import.meta.env.VITE_STORE_TIME_ZONE?.trim() || 'America/Mexico_City')

/** The earliest day the API accepts in date filters and reports. */
export const FIRST_DAY = '2000-01-01'

const formats = new Map<string, Intl.DateTimeFormat>()

// The calendar day (YYYY-MM-DD) of an instant in a zone, and its wall-clock time there read as UTC
// milliseconds (whole seconds), which gives the zone's offset.
function wallClock(instant: Date, timeZone: string) {
  let format = formats.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    formats.set(timeZone, format)
  }
  const parts = Object.fromEntries(format.formatToParts(instant).map((part) => [part.type, part.value]))
  return { day: `${parts.year}-${parts.month}-${parts.day}`, utc: Date.UTC(Number(parts.year), Number(parts.month) - 1,
    Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second)) }
}

/** The store's wall-clock time of an instant (or the given zone's) read as UTC, whole seconds. */
export function wallClockAsUtc(instant: Date, timeZone = STORE_TIME_ZONE): Date {
  return new Date(wallClock(instant, timeZone).utc)
}

/** The calendar day an instant (a Date or an ISO string) falls on in the store (or the given zone). */
export function toDay(instant: string | Date, timeZone = STORE_TIME_ZONE): string {
  return wallClock(typeof instant === 'string' ? new Date(instant) : instant, timeZone).day
}

function utcDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`)
}

export function addDays(day: string, days: number): string {
  const date = utcDate(day)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function lastDayOfMonth(day: string): string {
  const date = utcDate(day)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekday(day: string): number {
  return utcDate(day).getUTCDay()
}

/** Midnight of a calendar day in the store (or the given zone), as an instant for the list endpoints. */
export function startOfDay(day: string, timeZone = STORE_TIME_ZONE): string {
  const midnight = utcDate(day).getTime()
  // The zone's offset at a guess, then again at the result, for days when daylight saving changes.
  const offsetAt = (instant: number) => wallClock(new Date(instant), timeZone).utc - Math.floor(instant / 1000) * 1000
  const guess = midnight - offsetAt(midnight)
  return new Date(midnight - offsetAt(guess)).toISOString()
}

/** Midnight ending a day in the store (or the given zone), as the exclusive `to` of the list endpoints. */
export function dayAfter(day: string, timeZone = STORE_TIME_ZONE): string {
  return startOfDay(addDays(day, 1), timeZone)
}

/** Calendar days, both inclusive. */
export interface DayRange {
  from: string
  to: string
}

/** Today in the store's time zone, not the browser's. */
export function todayDay(): string {
  return toDay(new Date())
}

/** The last `days` calendar days, today included. */
export function lastDaysRange(days: number): DayRange {
  const today = todayDay()
  return { from: addDays(today, -(days - 1)), to: today }
}

/** Calendar days in a range, both ends included. */
export function daysInRange(range: DayRange): number {
  return Math.round((utcDate(range.to).getTime() - utcDate(range.from).getTime()) / 86_400_000) + 1
}
