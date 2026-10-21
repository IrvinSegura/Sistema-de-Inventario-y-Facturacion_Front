// Filters kept in the URL, so a link (or a reload) opens a list already filtered. Anything malformed
// reads as missing: a hand-edited or outdated link falls back to the defaults instead of failing.

import { type DayRange, daysInRange, FIRST_DAY } from './days'

const DAY_FORMAT = /^\d{4}-\d{2}-\d{2}$/

/** A real calendar day (YYYY-MM-DD) from FIRST_DAY to `today`; null otherwise. */
export function readDay(value: string | null, today: string): string | null {
  if (value === null || !DAY_FORMAT.test(value) || value < FIRST_DAY || value > today) {
    return null
  }
  // Date rolls "2026-02-30" over to March, so only a day that survives the round trip is real.
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null
}

/** `from` and `to` as a forward range of valid days, at most `maxDays` long when given; null otherwise. */
export function readRange(params: URLSearchParams, today: string, maxDays?: number): DayRange | null {
  const from = readDay(params.get('from'), today)
  const to = readDay(params.get('to'), today)
  if (from === null || to === null || from > to) {
    return null
  }
  const range = { from, to }
  return maxDays !== undefined && daysInRange(range) > maxDays ? null : range
}

/** A positive whole number (an id, a ticket number); null otherwise. */
export function readPositiveInt(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) {
    return null
  }
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

/** One of `options`; null otherwise. */
export function readOption<T extends string>(value: string | null, options: readonly T[]): T | null {
  return options.find((option) => option === value) ?? null
}

/**
 * Search params without the empty values (null, undefined or ''), in the order given, so the URL
 * only carries the filters that are set.
 */
export function compactParams(values: Record<string, string | number | null | undefined>): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && value !== '') {
      params.set(key, String(value))
    }
  }
  return params
}
