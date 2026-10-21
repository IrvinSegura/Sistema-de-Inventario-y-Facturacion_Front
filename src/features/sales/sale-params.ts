import { dayAfter, lastDaysRange, startOfDay } from '@/lib/days'
import { compactParams, readOption, readPositiveInt, readRange } from '@/lib/search-params'
import type { SortState } from '@/lib/sort'

import type { SaleDateField, SaleFilters, SaleStatus } from './queries'

// Also the API's sort fields for those dates.
export const SALE_DATE_FIELDS: SaleDateField[] = ['saleDate', 'cancelledAt']
export const SALE_STATUSES: SaleStatus[] = ['COMPLETED', 'CANCELLED']
export const DEFAULT_RANGE_DAYS = 7

/** The Sales page's filters from its URL; anything missing or malformed takes its default. */
export function readSaleFilters(params: URLSearchParams, today: string): SaleFilters {
  const dateField = readOption(params.get('dateField'), SALE_DATE_FIELDS) ?? 'saleDate'
  return {
    range: readRange(params, today) ?? lastDaysRange(DEFAULT_RANGE_DAYS, today),
    dateField,
    saleNumber: readPositiveInt(params.get('saleNumber')),
    sellerId: readPositiveInt(params.get('sellerId')),
    customerId: readPositiveInt(params.get('customerId')),
    // Only cancelled sales have a cancellation date.
    status: dateField === 'cancelledAt' ? 'CANCELLED' : readOption(params.get('status'), SALE_STATUSES),
  }
}

/**
 * The filters as search params, without the empty ones and the defaults that follow from others:
 * the sale date field, and the status when filtering by cancellation date.
 */
export function saleFilterParams(filters: Partial<SaleFilters>): URLSearchParams {
  const byCancellation = filters.dateField === 'cancelledAt'
  return compactParams({
    from: filters.range?.from,
    to: filters.range?.to,
    dateField: byCancellation ? filters.dateField : null,
    saleNumber: filters.saleNumber,
    sellerId: filters.sellerId,
    customerId: filters.customerId,
    status: byCancellation ? null : filters.status,
  })
}

/** The list endpoint's query for the filters; a ticket number searches every date. */
export function saleListQuery(filters: SaleFilters) {
  // The list takes instants (`to` exclusive), unlike the report, which takes the calendar days as they are.
  const from = startOfDay(filters.range.from)
  const to = dayAfter(filters.range.to)
  return {
    saleNumber: filters.saleNumber ?? undefined,
    sellerId: filters.sellerId ?? undefined,
    customerId: filters.customerId ?? undefined,
    // CANCELLED by cancellation date too, so a ticket number search (no dates) still allows sorting by it.
    status: filters.status ?? undefined,
    ...(filters.saleNumber === null
      && (filters.dateField === 'cancelledAt' ? { cancelledFrom: from, cancelledTo: to } : { from, to })),
  }
}

/**
 * The sort to send: one by the other date field is dropped, since the API sorts by cancellation
 * date only while every sale listed is cancelled (and the column shown is the chosen date's).
 */
export function effectiveSort(sort: SortState | null, dateField: SaleDateField): SortState | null {
  const otherDate = SALE_DATE_FIELDS.some((field) => field === sort?.field && field !== dateField)
  return otherDate ? null : sort
}

/** A link to the Sales page already filtered, e.g. Supervision's "today's cancellations". */
export function salesLink(filters: Partial<SaleFilters>): string {
  const query = saleFilterParams(filters).toString()
  return query ? `/sales?${query}` : '/sales'
}
