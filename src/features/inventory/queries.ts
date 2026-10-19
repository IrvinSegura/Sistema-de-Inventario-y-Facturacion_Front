import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from '@/api/client'
import { dayAfter, type DayRange, startOfDay } from '@/features/dashboard/days'
import { type SortState, sortParam } from '@/lib/sort'

export type Movement = Schemas['InventoryMovementResponse']
export type MovementType = NonNullable<Movement['type']>
export type LowStockProduct = Schemas['LowStockProductResponse']

export const MOVEMENT_TYPES: MovementType[] = ['PURCHASE', 'SALE', 'SALE_CANCELLATION', 'ADJUSTMENT']

export const PAGE_SIZE = 20
// The API pages at most 100 items.
const MAX_PAGE_SIZE = 100
export const MAX_EXPORT_ROWS = 2_000

export interface MovementFilters {
  productId: number
  type: MovementType | null
  range: DayRange | null
  // Upper bound fixed when the filters were set, so new movements don't shift the pages (the API
  // asks for it when paging a busy product).
  asOf: string
}

// Under 'inventory-movements': purchases, sales, cancellations and adjustments refresh it.
export const movementKeys = {
  all: ['inventory-movements'] as const,
  page: (filters: MovementFilters, page: number, size: number) => ['inventory-movements', 'page', filters, page, size] as const,
}

// Under 'stock-reports', like the dashboard's list: stock changes refresh it.
export const lowStockKeys = {
  page: (categoryId: number | null, page: number, size: number) => ['stock-reports', 'low-stock', 'page', categoryId, page, size] as const,
  all: (categoryId: number | null) => ['stock-reports', 'low-stock', 'all', categoryId] as const,
}

function movementQuery(filters: MovementFilters) {
  const rangeEnd = filters.range && dayAfter(filters.range.to)
  return {
    productId: filters.productId,
    type: filters.type ?? undefined,
    from: filters.range ? startOfDay(filters.range.from) : undefined,
    to: rangeEnd && rangeEnd < filters.asOf ? rangeEnd : filters.asOf,
  }
}

// One product's stock ledger, newest first.
export function useMovements(filters: MovementFilters | null, page: number, size = PAGE_SIZE) {
  return useQuery({
    queryKey: movementKeys.page(filters!, page, size),
    enabled: filters !== null,
    queryFn: () => unwrap(api.GET('/api/v1/inventory-movements', {
      params: { query: { ...movementQuery(filters!), page, size } },
    })),
    placeholderData: keepPreviousData,
  })
}

export async function fetchAllMovements(filters: MovementFilters) {
  const movements: Movement[] = []
  let total = 0
  for (let page = 0; movements.length < MAX_EXPORT_ROWS; page++) {
    const result = await unwrap(api.GET('/api/v1/inventory-movements', {
      params: { query: { ...movementQuery(filters), page, size: MAX_PAGE_SIZE } },
    }))
    movements.push(...(result.content ?? []))
    total = result.page?.totalElements ?? 0
    if (page + 1 >= (result.page?.totalPages ?? 0)) {
      break
    }
  }
  return { movements, truncated: total > movements.length }
}

// Active products at or below their minimum, most urgent first.
export function useLowStockPage(categoryId: number | null, page: number, size = PAGE_SIZE) {
  return useQuery({
    queryKey: lowStockKeys.page(categoryId, page, size),
    queryFn: () => unwrap(api.GET('/api/v1/stock-reports/low-stock', {
      params: { query: { categoryId: categoryId ?? undefined, page, size } },
    })),
    placeholderData: keepPreviousData,
  })
}

// Just the count, for the stock overview's tiles.
export function useLowStockCount() {
  return useQuery({
    queryKey: ['stock-reports', 'low-stock', 'count'] as const,
    queryFn: async () => {
      const page = await unwrap(api.GET('/api/v1/stock-reports/low-stock', { params: { query: { size: 1 } } }))
      return page.page?.totalElements ?? 0
    },
  })
}

// Every low-stock product of a category (or all), to restock them in one purchase.
export async function fetchAllLowStock(categoryId: number | null) {
  const products: LowStockProduct[] = []
  for (let page = 0; products.length < MAX_EXPORT_ROWS; page++) {
    const result = await unwrap(api.GET('/api/v1/stock-reports/low-stock', {
      params: { query: { categoryId: categoryId ?? undefined, page, size: MAX_PAGE_SIZE } },
    }))
    products.push(...(result.content ?? []))
    if (page + 1 >= (result.page?.totalPages ?? 0)) {
      break
    }
  }
  return products
}

// How many active products the store has.
export function useStockCounts() {
  return useQuery({
    queryKey: ['products', 'stock-counts'] as const,
    queryFn: async () => {
      const page = await unwrap(api.GET('/api/v1/products', { params: { query: { active: true, size: 1 } } }))
      return { active: page.page?.totalElements ?? 0 }
    },
  })
}

// Every product of the stock filters (up to MAX_EXPORT_ROWS), for the Excel report.
export async function fetchAllProducts(
  filters: { search: string; categoryId: number | null; active: boolean; lowStock: boolean },
  sort: SortState | null = null,
) {
  const products: Schemas['ProductResponse'][] = []
  let total = 0
  for (let page = 0; products.length < MAX_EXPORT_ROWS; page++) {
    const result = await unwrap(api.GET('/api/v1/products', {
      params: {
        query: {
          search: filters.search || undefined,
          categoryId: filters.categoryId ?? undefined,
          active: filters.active,
          lowStock: filters.lowStock,
          page,
          size: MAX_PAGE_SIZE,
          sort: sortParam(sort),
        },
      },
    }))
    products.push(...(result.content ?? []))
    total = result.page?.totalElements ?? 0
    if (page + 1 >= (result.page?.totalPages ?? 0)) {
      break
    }
  }
  return { products, truncated: total > products.length }
}
