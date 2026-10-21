import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from '@/api/client'
import { dayAfter, type DayRange, startOfDay } from '@/features/dashboard/days'
import { type SortState, sortParam } from '@/lib/sort'

export type SaleSummary = Schemas['SaleSummaryResponse']
export type SaleStatus = NonNullable<SaleSummary['status']>
export type SaleReport = Schemas['SaleReportResponse']

export const PAGE_SIZE = 20
// The API pages at most 100 items.
const MAX_PAGE_SIZE = 100
/** Exports stop at this many sales; what is left out is reported as truncated. */
export const MAX_EXPORT_ROWS = 2_000
/** The sales report covers at most 366 days. */
export const MAX_REPORT_DAYS = 366

export interface SaleFilters {
  range: DayRange
  /** A ticket number searches every date. */
  saleNumber: number | null
  sellerId: number | null
  customerId: number | null
  status: SaleStatus | null
}

// page is under 'sales' (like the drawer's tickets) and sellers under 'sale-reports'; a sale or
// cancellation anywhere invalidates both prefixes.
export const saleKeys = {
  page: (filters: SaleFilters, page: number, size: number, sort: SortState | null) =>
    ['sales', 'page', filters, page, size, sort] as const,
  sellers: (range: DayRange) => ['sale-reports', 'sellers', range] as const,
}

function saleQuery(filters: SaleFilters) {
  return {
    saleNumber: filters.saleNumber ?? undefined,
    sellerId: filters.sellerId ?? undefined,
    customerId: filters.customerId ?? undefined,
    status: filters.status ?? undefined,
    // The list takes instants (`to` exclusive), unlike the report, which takes the calendar days as they are.
    ...(filters.saleNumber === null && { from: startOfDay(filters.range.from), to: dayAfter(filters.range.to) }),
  }
}

/** Newest first, cancelled ones included unless filtered out. */
export function useSales(filters: SaleFilters, page: number, size = PAGE_SIZE, sort: SortState | null = null) {
  return useQuery({
    queryKey: saleKeys.page(filters, page, size, sort),
    queryFn: () => unwrap(api.GET('/api/v1/sales', { params: { query: { ...saleQuery(filters), page, size, sort: sortParam(sort) } } })),
    placeholderData: keepPreviousData,
  })
}

/** Every sale of the filters, up to MAX_EXPORT_ROWS; `truncated` tells whether more were left out. */
export async function fetchAllSales(filters: SaleFilters, sort: SortState | null = null) {
  const sales: SaleSummary[] = []
  let total = 0
  for (let page = 0; sales.length < MAX_EXPORT_ROWS; page++) {
    const result = await unwrap(api.GET('/api/v1/sales', {
      params: { query: { ...saleQuery(filters), page, size: MAX_PAGE_SIZE, sort: sortParam(sort) } },
    }))
    sales.push(...(result.content ?? []))
    total = result.page?.totalElements ?? 0
    if (page + 1 >= (result.page?.totalPages ?? 0)) {
      break
    }
  }
  return { sales, truncated: total > sales.length }
}

/**
 * Totals of completed sales, cancellations, payment methods and sellers for the period (up to
 * MAX_REPORT_DAYS); under 'sale-reports' so new sales and cancellations refresh it.
 */
export function useSalesSummary(range: DayRange, sellerId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ['sale-reports', 'sales-page', range, sellerId] as const,
    enabled,
    queryFn: () => fetchSalesReport(range, sellerId),
    placeholderData: keepPreviousData,
  })
}

export function fetchSalesReport(range: DayRange, sellerId: number | null) {
  return unwrap(api.GET('/api/v1/sale-reports', { params: { query: { ...range, sellerId: sellerId ?? undefined } } }))
}
