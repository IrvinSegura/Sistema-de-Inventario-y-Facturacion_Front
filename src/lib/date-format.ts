import { intlLocale } from '@/i18n/intl-locale'

import { STORE_TIME_ZONE, toDay } from './days'

export type DateStyle = 'medium' | 'long'

/** An instant as the API sends it (ISO string), a timestamp or a Date; optional fields may be missing. */
export type Instant = string | number | Date | null | undefined

// One per locale, zone and options: building a DateTimeFormat costs far more than formatting with it.
const formats = new Map<string, Intl.DateTimeFormat>()

function zonedFormat(language: string, timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const locale = intlLocale(language)
  const key = `${locale}|${timeZone}|${JSON.stringify(options)}`
  let format = formats.get(key)
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { ...options, timeZone })
    formats.set(key, format)
  }
  return format
}

/** The instant as a valid Date, or null when it's missing or malformed (`new Date(null)` would be 1970). */
function validDate(instant: Instant): Date | null {
  if (instant === null || instant === undefined) {
    return null
  }
  const date = new Date(instant)
  return Number.isNaN(date.getTime()) ? null : date
}

// Intl throws on an invalid date, which would take the whole screen down: a dash instead.
function formatInstant(format: Intl.DateTimeFormat, instant: Instant): string {
  const date = validDate(instant)
  return date ? format.format(date) : '—'
}

/**
 * Hour and minute of an instant on the store's clock (or the given zone's), whatever zone the
 * browser is in, so times agree with the store days they're listed under. A missing or malformed
 * instant shows as a dash.
 */
export function formatTime(instant: Instant, language: string, timeZone = STORE_TIME_ZONE): string {
  return formatInstant(zonedFormat(language, timeZone, { hour: '2-digit', minute: '2-digit' }), instant)
}

/**
 * Date and time of an instant on the store's clock, like formatTime: 'medium' for lists and
 * dialogs, 'long' for printed documents.
 */
export function formatDateTime(
  instant: Instant, language: string, style: DateStyle = 'medium', timeZone = STORE_TIME_ZONE,
): string {
  return formatInstant(zonedFormat(language, timeZone, { dateStyle: style, timeStyle: 'short' }), instant)
}

/** A calendar day ("2026-10-15") as it is, whatever zone the browser is in. */
export function formatDate(day: string, language: string, style: DateStyle = 'medium'): string {
  // Midnight UTC formatted in UTC: the same convention days.ts uses for day arithmetic.
  return formatInstant(zonedFormat(language, 'UTC', { dateStyle: style }), `${day}T00:00:00Z`)
}

/** The store day an instant falls on (a sale's, an account's creation), like formatDate; a dash when missing. */
export function formatStoreDate(instant: Instant, language: string, style: DateStyle = 'medium', timeZone = STORE_TIME_ZONE): string {
  const date = validDate(instant)
  return date ? formatDate(toDay(date, timeZone), language, style) : '—'
}
