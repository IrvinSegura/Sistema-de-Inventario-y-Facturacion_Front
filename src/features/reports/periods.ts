import { addDays, type DayRange, daysInRange, lastDayOfMonth, weekday } from '@/features/dashboard/days'
import { fromCents, toCents } from '@/lib/money'

export type Grouping = 'day' | 'week' | 'month'
export const groupings: Grouping[] = ['day', 'week', 'month']

// First and last calendar day a bucket covers, both inclusive.
export interface Bucket {
  start: string
  end: string
}

// The period of the same length that ends the day before `range` starts.
export function previousRange(range: DayRange): DayRange {
  const days = daysInRange(range)
  return { from: addDays(range.from, -days), to: addDays(range.from, -1) }
}

// Change from `previous` to `current` as a fraction (0.25 = +25 %); null when the previous value is
// zero and the current one isn't, since no percentage describes growing from nothing.
export function change(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null
  }
  return (current - previous) / Math.abs(previous)
}

// Days for up to a month, weeks for up to four months, months beyond.
export function defaultGrouping(range: DayRange): Grouping {
  const days = daysInRange(range)
  return days <= 31 ? 'day' : days <= 120 ? 'week' : 'month'
}

// Last day of the bucket that starts on `day`: the same day, the Sunday of its week (weeks start on
// Monday) or the last day of its month.
function bucketEnd(day: string, grouping: Grouping): string {
  switch (grouping) {
    case 'day':
      return day
    case 'week':
      return addDays(day, (7 - weekday(day)) % 7)
    case 'month':
      return lastDayOfMonth(day)
  }
}

// Calendar buckets covering the whole range; the first and last ones are cut to the range.
export function buckets(range: DayRange, grouping: Grouping): Bucket[] {
  const result: Bucket[] = []
  for (let start = range.from; start <= range.to;) {
    const last = bucketEnd(start, grouping)
    const end = last < range.to ? last : range.to
    result.push({ start, end })
    start = addDays(end, 1)
  }
  return result
}

// Integer cents per calendar day, adding up entries of the same day.
export function centsByDay<T>(items: T[], day: (item: T) => string | undefined, amount: (item: T) => number | undefined) {
  const cents = new Map<string, number>()
  for (const item of items) {
    const key = day(item)
    if (key) {
      cents.set(key, (cents.get(key) ?? 0) + toCents(amount(item) ?? 0))
    }
  }
  return cents
}

// Total of a bucket's days, `shift` days away (to read the same days of another period).
export function sumBucket(bucket: Bucket, cents: Map<string, number>, shift = 0): number {
  let total = 0
  for (let day = bucket.start; day <= bucket.end; day = addDays(day, 1)) {
    total += cents.get(addDays(day, shift)) ?? 0
  }
  return fromCents(total)
}

export interface ComparisonPoint extends Bucket {
  current: number
  previous: number
}

// Sales of each bucket next to the same days of the previous period, which is `range` shifted back
// by its own length.
export function comparisonSeries(range: DayRange, grouping: Grouping, current: Map<string, number>,
  previous: Map<string, number>): ComparisonPoint[] {
  const shift = -daysInRange(range)
  return buckets(range, grouping).map((bucket) => ({
    ...bucket,
    current: sumBucket(bucket, current),
    previous: sumBucket(bucket, previous, shift),
  }))
}

export interface FlowPoint extends Bucket {
  sales: number
  purchases: number
  net: number
  // Net flow from the start of the range to the end of this bucket.
  cumulative: number
}

// Money in (sales) and out (purchases) per bucket, with every bucket present even without movements.
export function flowSeries(range: DayRange, grouping: Grouping, sales: Map<string, number>,
  purchases: Map<string, number>): FlowPoint[] {
  let cumulative = 0
  return buckets(range, grouping).map((bucket) => {
    const salesTotal = sumBucket(bucket, sales)
    const purchasesTotal = sumBucket(bucket, purchases)
    const net = fromCents(toCents(salesTotal) - toCents(purchasesTotal))
    cumulative += toCents(net)
    return { ...bucket, sales: salesTotal, purchases: purchasesTotal, net, cumulative: fromCents(cumulative) }
  })
}

// The whole range's money in and out.
export function flowTotals(series: FlowPoint[]) {
  const sales = series.reduce((total, point) => total + toCents(point.sales), 0)
  const purchases = series.reduce((total, point) => total + toCents(point.purchases), 0)
  return { sales: fromCents(sales), purchases: fromCents(purchases), net: fromCents(sales - purchases) }
}
