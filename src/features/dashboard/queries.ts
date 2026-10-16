import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from '@/api/client'

import { dayAfter, type DayRange, startOfDay } from './days'

export type SaleReport = Schemas['SaleReportResponse']
export type SaleSummary = Schemas['SaleSummaryResponse']
export type PurchaseSummary = Schemas['PurchaseSummaryResponse']
export type LowStockProduct = Schemas['LowStockProductResponse']

export const dashboardKeys = {
  report: (range: DayRange) => ['sale-reports', range] as const,
  recentSales: (range: DayRange) => ['sales', 'recent', range] as const,
  purchases: (range: DayRange) => ['purchases', 'range', range] as const,
  lowStock: ['stock-reports', 'low-stock'] as const,
}

// Totals, payment methods, top products and a daily breakdown; sellers only get their own sales.
export function useSaleReport(range: DayRange) {
  return useQuery({
    queryKey: dashboardKeys.report(range),
    queryFn: () => unwrap(api.GET('/api/v1/sale-reports', { params: { query: range } })),
    placeholderData: keepPreviousData,
  })
}

const RECENT_COUNT = 8

// Newest sales of the period, cancelled ones included.
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

// The API pages at most 100 items; a few pages cover a store's purchases for 90 days.
const PURCHASE_PAGE_SIZE = 100
const MAX_PURCHASE_PAGES = 5

// Every purchase of the period, newest first, to chart money out (admins and supervisors).
export function usePurchases(range: DayRange, enabled: boolean) {
  return useQuery({
    queryKey: dashboardKeys.purchases(range),
    enabled,
    queryFn: async () => {
      const purchases: PurchaseSummary[] = []
      for (let page = 0; page < MAX_PURCHASE_PAGES; page++) {
        const result = await unwrap(api.GET('/api/v1/purchases', {
          params: {
            query: { from: startOfDay(range.from), to: dayAfter(range.to), page, size: PURCHASE_PAGE_SIZE },
          },
        }))
        purchases.push(...(result.content ?? []))
        if (page + 1 >= (result.page?.totalPages ?? 0)) {
          break
        }
      }
      return purchases
    },
    placeholderData: keepPreviousData,
  })
}

const LOW_STOCK_COUNT = 6

// Products at or below their minimum stock, most urgent first.
export function useLowStock() {
  return useQuery({
    queryKey: dashboardKeys.lowStock,
    queryFn: () => unwrap(api.GET('/api/v1/stock-reports/low-stock', { params: { query: { size: LOW_STOCK_COUNT } } })),
  })
}
