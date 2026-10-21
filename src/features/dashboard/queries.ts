import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from '@/api/client'
import { dayAfter, type DayRange, startOfDay } from '@/lib/days'

export type SaleReport = Schemas['SaleReportResponse']
export type SaleSummary = Schemas['SaleSummaryResponse']
export type PurchaseSummary = Schemas['PurchaseSummaryResponse']
export type LowStockProduct = Schemas['LowStockProductResponse']

export const dashboardKeys = {
  report: (range: DayRange) => ['sale-reports', range] as const,
  recentSales: (range: DayRange) => ['sales', 'recent', range] as const,
  recentPurchases: (range: DayRange) => ['purchases', 'recent', range] as const,
  lowStock: ['stock-reports', 'low-stock'] as const,
}

/** Totals, payment methods, top products and a daily breakdown; sellers only get their own sales. */
export function useSaleReport(range: DayRange) {
  return useQuery({
    queryKey: dashboardKeys.report(range),
    // Reports take calendar days as they are; the list endpoints below need instants.
    queryFn: () => unwrap(api.GET('/api/v1/sale-reports', { params: { query: range } })),
    placeholderData: keepPreviousData,
  })
}

const RECENT_COUNT = 8

/** The RECENT_COUNT newest sales of the period, cancelled ones included. */
export function useRecentSales(range: DayRange) {
  return useQuery({
    queryKey: dashboardKeys.recentSales(range),
    queryFn: async () => {
      const page = await unwrap(api.GET('/api/v1/sales', {
        params: { query: { from: startOfDay(range.from), to: dayAfter(range.to), size: RECENT_COUNT } },
      }))
      return page.content ?? []
    },
    placeholderData: keepPreviousData,
  })
}

/**
 * Newest purchases of the period, for the latest movements (admins and supervisors); the totals and
 * the chart come from the purchases summary.
 */
export function useRecentPurchases(range: DayRange, enabled: boolean) {
  return useQuery({
    queryKey: dashboardKeys.recentPurchases(range),
    enabled,
    queryFn: async () => {
      const page = await unwrap(api.GET('/api/v1/purchases', {
        params: { query: { from: startOfDay(range.from), to: dayAfter(range.to), size: RECENT_COUNT } },
      }))
      return page.content ?? []
    },
    placeholderData: keepPreviousData,
  })
}

const LOW_STOCK_COUNT = 6

/** Products at or below their minimum stock, most urgent first; only the first LOW_STOCK_COUNT. */
export function useLowStock() {
  return useQuery({
    queryKey: dashboardKeys.lowStock,
    queryFn: () => unwrap(api.GET('/api/v1/stock-reports/low-stock', { params: { query: { size: LOW_STOCK_COUNT } } })),
  })
}
