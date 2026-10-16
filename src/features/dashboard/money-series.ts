import { fromCents, toCents } from '@/lib/money'

import { addDays, type DayRange, toDay } from './days'

export interface MoneyBucket {
  // First and last calendar day the bucket covers (the same day for daily buckets).
  start: string
  end: string
  sales: number
  purchases: number
}

interface DailyTotal {
  date?: string
  total?: number
}

interface Purchase {
  purchaseDate?: string
  total?: number
}

// Money in (sales) and out (purchases) per bucket of `bucketDays`, covering every day of the range:
// days without movements show as zero instead of disappearing from the chart.
export function moneySeries(range: DayRange, salesByDay: DailyTotal[], purchases: Purchase[],
  bucketDays: number): MoneyBucket[] {
  const salesCents = new Map<string, number>()
  for (const { date, total } of salesByDay) {
    if (date) {
      salesCents.set(date, (salesCents.get(date) ?? 0) + toCents(total ?? 0))
    }
  }
  const purchaseCents = new Map<string, number>()
  for (const { purchaseDate, total } of purchases) {
    if (purchaseDate) {
      const day = toDay(new Date(purchaseDate))
      purchaseCents.set(day, (purchaseCents.get(day) ?? 0) + toCents(total ?? 0))
    }
  }

  const buckets: MoneyBucket[] = []
  for (let start = range.from; start <= range.to; start = addDays(start, bucketDays)) {
    const last = addDays(start, bucketDays - 1)
    const end = last < range.to ? last : range.to
    let sales = 0
    let spent = 0
    for (let day = start; day <= end; day = addDays(day, 1)) {
      sales += salesCents.get(day) ?? 0
      spent += purchaseCents.get(day) ?? 0
    }
    buckets.push({ start, end, sales: fromCents(sales), purchases: fromCents(spent) })
  }
  return buckets
}
