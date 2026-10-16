import { dateLocale } from '@/i18n'

// The API stores VAT as a fraction with up to 4 decimals (0.16); people type and read a percentage
// with up to 2 (16, 8, 0).

export function toPercent(rate: number): number {
  return Number((rate * 100).toFixed(2))
}

export function fromPercent(percent: number): number {
  return Number((percent / 100).toFixed(4))
}

// "16 %", "8 %", "0 %" in the current language.
export function formatTaxRate(rate: number, language: string): string {
  return new Intl.NumberFormat(dateLocale(language), { style: 'percent', maximumFractionDigits: 2 }).format(rate)
}
