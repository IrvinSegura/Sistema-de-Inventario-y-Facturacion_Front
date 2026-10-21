import { cn } from '@/lib/utils'

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
