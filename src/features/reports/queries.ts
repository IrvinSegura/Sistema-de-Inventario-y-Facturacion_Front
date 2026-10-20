import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from '@/api/client'
import type { DayRange } from '@/features/dashboard/days'

export type ProductSales = Schemas['ProductSalesResponse']
export type CustomerSales = Schemas['CustomerSalesResponse']

// The API pages at most 100 items; exports stop at this many rows.
const MAX_PAGE_SIZE = 100
export const MAX_EXPORT_ROWS = 2_000

export interface ProductSalesFilters {
  range: DayRange
  categoryId: number | null
  // Products in stock that didn't sell, instead of the ones that did.
  unsold: boolean
}

// Value of the units on hand at their average cost; unknown until the product is first purchased.
export function stockValue(product: ProductSales): number | null {
  return product.averageCost === undefined || product.averageCost === null
    ? null
    : Math.round((product.stock ?? 0) * product.averageCost * 100) / 100
}

// Under 'sale-reports' so a sale or cancellation anywhere refreshes them.
export const reportKeys = {
  products: (filters: ProductSalesFilters, page: number, size: number) =>
    ['sale-reports', 'by-product', filters, page, size] as const,
  customers: (range: DayRange, page: number, size: number) => ['sale-reports', 'by-customer', range, page, size] as const,
}

function productQuery(filters: ProductSalesFilters, page: number, size: number) {
  return { ...filters.range, categoryId: filters.categoryId ?? undefined, unsold: filters.unsold, page, size }
}

// Products sold in the period, best first by amount, or the ones that didn't sell (managers only).
export function useProductSales(filters: ProductSalesFilters, page: number, size: number) {
  return useQuery({
    queryKey: reportKeys.products(filters, page, size),
    queryFn: () => unwrap(api.GET('/api/v1/sale-reports/by-product', {
      params: { query: productQuery(filters, page, size) },
    })),
    placeholderData: keepPreviousData,
  })
}

// Registered customers by what they bought in the period, best first (managers only).
export function useCustomerSales(range: DayRange, page: number, size: number) {
  return useQuery({
    queryKey: reportKeys.customers(range, page, size),
    queryFn: () => unwrap(api.GET('/api/v1/sale-reports/by-customer', { params: { query: { ...range, page, size } } })),
    placeholderData: keepPreviousData,
  })
}

// Every page of a report, up to MAX_EXPORT_ROWS; truncated tells whether more were left out.
async function fetchAll<T>(fetchPage: (page: number) => Promise<{ content?: T[]; page?: Schemas['PageMetadata'] }>) {
  const rows: T[] = []
  let total = 0
  for (let page = 0; rows.length < MAX_EXPORT_ROWS; page++) {
    const result = await fetchPage(page)
    rows.push(...(result.content ?? []))
    total = result.page?.totalElements ?? 0
    if (page + 1 >= (result.page?.totalPages ?? 0)) {
      break
    }
  }
  return { rows, truncated: total > rows.length }
}

export function fetchAllProductSales(filters: ProductSalesFilters) {
  return fetchAll((page) => unwrap(api.GET('/api/v1/sale-reports/by-product', {
    params: { query: productQuery(filters, page, MAX_PAGE_SIZE) },
  })))
}

export function fetchAllCustomerSales(range: DayRange) {
  return fetchAll((page) => unwrap(api.GET('/api/v1/sale-reports/by-customer', {
    params: { query: { ...range, page, size: MAX_PAGE_SIZE } },
  })))
}
