import { addDays, type DayRange } from '@/lib/days'
import { fromCents, toCents } from '@/lib/money'

export interface MoneyBucket {
  /** First calendar day the bucket covers. */
  start: string
  /** Last calendar day the bucket covers, included; the same as start for daily buckets. */
  end: string
  sales: number
  purchases: number
}

interface DailyTotal {
  date?: string
  total?: number
}

function centsByDay(days: DailyTotal[]) {
  const cents = new Map<string, number>()
  for (const { date, total } of days) {
    if (date) {
      cents.set(date, (cents.get(date) ?? 0) + toCents(total ?? 0))
    }
  }
  return cents
}

/**
 * Money in (sales) and out (purchases) per bucket of `bucketDays`, from the reports' daily totals,
 * covering every day of the range: days without movements show as zero instead of disappearing.
 * The last bucket ends at the range's end, so it may be shorter.
 */
export function moneySeries(range: DayRange, salesByDay: DailyTotal[], purchasesByDay: DailyTotal[],
  bucketDays: number): MoneyBucket[] {
  const salesCents = centsByDay(salesByDay)
  const purchaseCents = centsByDay(purchasesByDay)

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
