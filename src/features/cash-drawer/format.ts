import { STORE_TIME_ZONE } from '@/features/dashboard/days'
import { dateLocale } from '@/i18n'
import { cn } from '@/lib/utils'

// One per locale and zone: building a DateTimeFormat costs far more than formatting with it.
const timeFormats = new Map<string, Intl.DateTimeFormat>()

/**
 * Hour and minute of an instant on the store's clock (or the given zone's), whatever zone the
 * browser is in, so times agree with the store days they're listed under. A missing or malformed
 * instant shows as a dash.
 */
export function formatTime(instant: string | number | Date, language: string, timeZone = STORE_TIME_ZONE): string {
  const locale = dateLocale(language)
  const key = `${locale}|${timeZone}`
  let format = timeFormats.get(key)
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone })
    timeFormats.set(key, format)
  }
  const date = new Date(instant)
  // Intl throws on an invalid date, which would take the whole screen down.
  return Number.isNaN(date.getTime()) ? '—' : format.format(date)
}

/** Business dates are plain local days ("2026-10-15"); parsed at noon so no time zone shifts the day. */
export function formatDate(day: string, language: string, style: 'medium' | 'long' = 'medium'): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString(dateLocale(language), { dateStyle: style })
}

const wholePesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
const pesosAndCents = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

/** Whole pesos without cents ($1,000), fractions with them ($0.50). */
export function formatDenomination(value: number): string {
  return (Number.isInteger(value) ? wholePesos : pesosAndCents).format(value)
}

/** i18n key naming a closing difference: shortage when negative, surplus when positive. */
export function differenceLabel(difference: number) {
  return difference < 0 ? 'drawer.shortage' : difference > 0 ? 'drawer.surplus' : 'drawer.difference'
}

/** Shortage in red, surplus in amber. */
export function differenceClass(difference: number) {
  return cn('tabular-nums', difference < 0 && 'text-destructive', difference > 0 && 'text-amber-600 dark:text-amber-400')
}
