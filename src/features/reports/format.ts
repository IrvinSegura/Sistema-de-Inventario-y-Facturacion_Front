import { intlLocale } from '@/i18n/intl-locale'
import { formatDate, formatDay, formatDayRange } from '@/lib/date-format'
import { lastDayOfMonth } from '@/lib/days'

import type { Bucket, Grouping } from './periods'

/** Short label for a chart axis: "19 oct", the Monday of a week, or "oct 2026". */
export function bucketLabel(bucket: Bucket, grouping: Grouping, language: string): string {
  return formatDay(bucket.start, language, grouping === 'month'
    ? { month: 'short', year: 'numeric' }
    : { day: 'numeric', month: 'short' })
}

/** Full label for tables, tooltips and reports: "19 oct 2026", "13 – 19 oct 2026" or "octubre de 2026". */
export function bucketTitle(bucket: Bucket, grouping: Grouping, language: string): string {
  // Only a whole calendar month gets its name; a month cut by the range shows its dates.
  if (grouping === 'month' && bucket.start.endsWith('-01') && bucket.end === lastDayOfMonth(bucket.start)) {
    return formatDay(bucket.start, language, { month: 'long', year: 'numeric' })
  }
  if (bucket.start === bucket.end) {
    return formatDate(bucket.start, language)
  }
  return formatDayRange(bucket.start, bucket.end, language)
}

/** "+12.5 %", "−3 %" or "0 %"; null (growth from zero) has no percentage. */
export function formatChange(value: number | null, language: string): string {
  if (value === null) {
    return '—'
  }
  return new Intl.NumberFormat(intlLocale(language), {
    style: 'percent', maximumFractionDigits: 1, signDisplay: 'exceptZero',
  }).format(value)
}

export function formatCount(value: number, language: string): string {
  return value.toLocaleString(intlLocale(language))
}

export function formatPercent(value: number, language: string): string {
  return new Intl.NumberFormat(intlLocale(language), { style: 'percent', maximumFractionDigits: 1 }).format(value)
}
