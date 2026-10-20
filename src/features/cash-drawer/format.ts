import { dateLocale } from '@/i18n'
import { cn } from '@/lib/utils'

export function formatTime(instant: string, language: string): string {
  return new Date(instant).toLocaleTimeString(dateLocale(language), { hour: '2-digit', minute: '2-digit' })
}

// Business dates are plain local days ("2026-10-15"); parsed at noon so no time zone shifts the day.
export function formatDate(day: string, language: string, style: 'medium' | 'long' = 'medium'): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString(dateLocale(language), { dateStyle: style })
}

const wholePesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
const pesosAndCents = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

// $1,000 for bills, $0.50 for cents.
export function formatDenomination(value: number): string {
  return (Number.isInteger(value) ? wholePesos : pesosAndCents).format(value)
}

// Shortage in red, surplus in amber.
export function differenceLabel(difference: number) {
  return difference < 0 ? 'drawer.shortage' : difference > 0 ? 'drawer.surplus' : 'drawer.difference'
}

export function differenceClass(difference: number) {
  return cn('tabular-nums', difference < 0 && 'text-destructive', difference > 0 && 'text-amber-600 dark:text-amber-400')
}
