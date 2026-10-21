import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from '@/api/client'
import { dayAfter, type DayRange, startOfDay } from '@/lib/days'
import type { LiveOptions } from '@/lib/live'
import { type SortState, sortParam } from '@/lib/sort'

export type Movement = Schemas['InventoryMovementResponse']
export type MovementType = NonNullable<Movement['type']>
export type LowStockProduct = Schemas['LowStockProductResponse']

export const PAGE_SIZE = 20
// The API pages at most 100 items.
const MAX_PAGE_SIZE = 100
/** Most rows the fetchAll helpers read, for the Excel exports and restocking everything at once. */
export const MAX_EXPORT_ROWS = 2_000

/** A product's ledger, or with productId null one type across the store (type and range then required). */
export interface MovementFilters {
  productId: number | null
  type: MovementType | null
  range: DayRange | null
  /**
   * Upper bound fixed when the filters were set, so new movements don't shift the pages (the API
   * asks for it when paging a busy product); null lists up to the newest.
   */
  asOf: string | null
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
    productId: filters.productId ?? undefined,
    type: filters.type ?? undefined,
    from: filters.range ? startOfDay(filters.range.from) : undefined,
    // The earlier of the range's end and asOf (either may be missing); both are UTC ISO strings, so
    // they compare as text.
    to: rangeEnd && (filters.asOf === null || rangeEnd < filters.asOf) ? rangeEnd : filters.asOf ?? undefined,
  }
}

/** The stock ledger the filters ask for, newest first; idle while filters is null. */
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

/** The whole filtered ledger, newest first, up to MAX_EXPORT_ROWS; `truncated` tells if there were more. */
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

/** How many movements of a type the whole store recorded on a day, for the supervision alerts. */
export function useDayMovementCount(type: MovementType, day: string, { refetchInterval, staleTime }: LiveOptions = {}) {
  return useQuery({
    // Under movementKeys.all, so a new adjustment refreshes it.
    queryKey: [...movementKeys.all, 'day-count', type, day] as const,
    queryFn: async () => {
      const page = await unwrap(api.GET('/api/v1/inventory-movements', {
        params: { query: { type, from: startOfDay(day), to: dayAfter(day), size: 1 } },
      }))
      return page.page?.totalElements ?? 0
    },
    refetchInterval,
    staleTime,
  })
}

/** Active products at or below their minimum, most urgent first. */
export function useLowStockPage(categoryId: number | null, page: number, size = PAGE_SIZE) {
  return useQuery({
    queryKey: lowStockKeys.page(categoryId, page, size),
    queryFn: () => unwrap(api.GET('/api/v1/stock-reports/low-stock', {
      params: { query: { categoryId: categoryId ?? undefined, page, size } },
    })),
    placeholderData: keepPreviousData,
  })
}

/** Just the count, for the stock overview's tiles and the supervision alerts (which poll it). */
export function useLowStockCount({ refetchInterval, staleTime }: LiveOptions = {}) {
  return useQuery({
    queryKey: ['stock-reports', 'low-stock', 'count'] as const,
    queryFn: async () => {
      const page = await unwrap(api.GET('/api/v1/stock-reports/low-stock', { params: { query: { size: 1 } } }))
      return page.page?.totalElements ?? 0
    },
    refetchInterval,
    staleTime,
  })
}

/**
 * Every low-stock product of a category (or all), up to MAX_EXPORT_ROWS, to restock or export them
 * at once.
 */
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

/** How many active products the store has. */
export function useStockCounts() {
  return useQuery({
    queryKey: ['products', 'stock-counts'] as const,
    queryFn: async () => {
      const page = await unwrap(api.GET('/api/v1/products', { params: { query: { active: true, size: 1 } } }))
      return { active: page.page?.totalElements ?? 0 }
    },
  })
}

/**
 * Every product of the stock filters (up to MAX_EXPORT_ROWS), for the Excel report; `truncated`
 * tells if there were more.
 */
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
