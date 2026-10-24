import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from '@/api/client'
import { ApiError } from '@/api/errors'
import { dayAfter, type DayRange, startOfDay } from '@/lib/days'
import type { LiveOptions } from '@/lib/live'
import { type SortState, sortParam } from '@/lib/sort'

export type Supplier = Schemas['SupplierResponse']
export type CreateSupplier = Schemas['CreateSupplierRequest']
export type UpdateSupplier = Schemas['UpdateSupplierRequest']
export type Purchase = Schemas['PurchaseResponse']
export type PurchaseSummary = Schemas['PurchaseSummaryResponse']
export type PurchaseReport = Schemas['PurchaseReportResponse']

export const PAGE_SIZE = 20
// The API pages at most 100 items.
const MAX_PAGE_SIZE = 100
/** Most purchases an Excel export reads; a longer period should be split. */
export const MAX_EXPORT_ROWS = 2_000
/** How many matches the supplier picker shows. */
export const SUPPLIER_MATCHES = 6

export interface SupplierFilters {
  search: string
  active: boolean
}

export interface PurchaseFilters {
  range: DayRange
  supplierId: number | null
}

export const supplierKeys = {
  all: ['suppliers'] as const,
  page: (filters: SupplierFilters, page: number, size: number, sort: SortState | null) =>
    ['suppliers', 'page', filters, page, size, sort] as const,
  picker: (search: string) => ['suppliers', 'picker', search] as const,
  list: ['suppliers', 'list'] as const,
}

// Under 'purchases' (like the dashboard's), so recording one refreshes every list.
export const purchaseKeys = {
  all: ['purchases'] as const,
  page: (filters: PurchaseFilters, page: number, size: number, sort: SortState | null) =>
    ['purchases', 'page', filters, page, size, sort] as const,
  detail: (id: number) => ['purchases', 'detail', id] as const,
}

/** Sorted by name on the server; the search matches the name or the tax ID, blank means "all". */
export function useSuppliers(filters: SupplierFilters, page: number, size = PAGE_SIZE, sort: SortState | null = null) {
  return useQuery({
    queryKey: supplierKeys.page(filters, page, size, sort),
    queryFn: () => unwrap(api.GET('/api/v1/suppliers', {
      params: { query: { search: filters.search || undefined, active: filters.active, page, size, sort: sortParam(sort) } },
    })),
    placeholderData: keepPreviousData,
  })
}

/** Active suppliers by name or tax ID for the picker; nothing is requested until something is typed. */
export function useSupplierSearch(search: string) {
  return useQuery({
    queryKey: supplierKeys.picker(search),
    queryFn: () => unwrap(api.GET('/api/v1/suppliers', {
      params: { query: { search, active: true, page: 0, size: SUPPLIER_MATCHES } },
    })),
    enabled: search !== '',
    placeholderData: keepPreviousData,
  })
}

/** Every supplier, active ones first, for the purchases filter; a store has a few dozen. */
export function useAllSuppliers() {
  return useQuery({
    queryKey: supplierKeys.list,
    queryFn: async () => {
      const [active, inactive] = await Promise.all([true, false].map((isActive) =>
        unwrap(api.GET('/api/v1/suppliers', { params: { query: { active: isActive, size: MAX_PAGE_SIZE } } }))))
      return [...(active.content ?? []), ...(inactive.content ?? [])]
    },
  })
}

export function useCreateSupplier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateSupplier) => unwrap(api.POST('/api/v1/suppliers', { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: supplierKeys.all }),
  })
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateSupplier & { id: number }) =>
      unwrap(api.PUT('/api/v1/suppliers/{id}', { params: { path: { id } }, body })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: supplierKeys.all })
      // Purchases show the supplier's name.
      void queryClient.invalidateQueries({ queryKey: purchaseKeys.all })
    },
    // Someone else saved first: reload the list so reopening the supplier shows their version.
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: supplierKeys.all })
      }
    },
  })
}

function purchaseQuery(filters: PurchaseFilters) {
  return {
    supplierId: filters.supplierId ?? undefined,
    from: startOfDay(filters.range.from),
    to: dayAfter(filters.range.to),
  }
}

/** Newest first, without items (the detail has them). */
export function usePurchases(filters: PurchaseFilters, page: number, size = PAGE_SIZE, sort: SortState | null = null) {
  return useQuery({
    queryKey: purchaseKeys.page(filters, page, size, sort),
    queryFn: () => unwrap(api.GET('/api/v1/purchases', {
      params: { query: { ...purchaseQuery(filters), page, size, sort: sortParam(sort) } },
    })),
    placeholderData: keepPreviousData,
  })
}

/** One purchase with its lines; idle while id is null. */
export function usePurchase(id: number | null) {
  return useQuery({
    queryKey: purchaseKeys.detail(id ?? 0),
    enabled: id !== null,
    queryFn: () => unwrap(api.GET('/api/v1/purchases/{id}', { params: { path: { id: id! } } })),
  })
}

/**
 * Every completed purchase of the filters, up to MAX_EXPORT_ROWS; `truncated` tells whether more were
 * left out. Cancelled ones are left out, as in the API's summary: their units went back.
 */
export async function fetchAllPurchases(filters: PurchaseFilters, sort: SortState | null = null) {
  const purchases: PurchaseSummary[] = []
  let total = 0
  for (let page = 0; purchases.length < MAX_EXPORT_ROWS; page++) {
    const result = await unwrap(api.GET('/api/v1/purchases', {
      params: { query: { ...purchaseQuery(filters), status: 'COMPLETED', page, size: MAX_PAGE_SIZE, sort: sortParam(sort) } },
    }))
    purchases.push(...(result.content ?? []))
    total = result.page?.totalElements ?? 0
    if (page + 1 >= (result.page?.totalPages ?? 0)) {
      break
    }
  }
  return { purchases, truncated: total > purchases.length }
}

export interface PurchaseInput {
  idempotencyKey: string
  supplierId: number
  items: { productId: number; quantity: number; unitCost: number }[]
}

/**
 * The caller creates the idempotency key once per purchase and reuses it on retries, so a double click
 * or a lost response never adds the stock twice: the API returns the purchase it already recorded.
 */
export function useRecordPurchase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ idempotencyKey, ...body }: PurchaseInput) =>
      unwrap(api.POST('/api/v1/purchases', {
        params: { header: { 'Idempotency-Key': idempotencyKey } },
        body,
      })),
    // Seeds the detail the page opens right after recording; the purchase also changes stock and its movements.
    onSuccess: (purchase) => {
      queryClient.setQueryData(purchaseKeys.detail(purchase.id!), purchase)
      void queryClient.invalidateQueries({ queryKey: purchaseKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory-movements'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-reports'] })
    },
  })
}

/**
 * Admins and supervisors. Every unit the purchase brought leaves stock, or nothing changes when some
 * were already sold (409); a cancelled purchase stops counting in the summary.
 */
export function useCancelPurchase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      unwrap(api.POST('/api/v1/purchases/{id}/cancellation', { params: { path: { id } }, body: { reason } })),
    onSuccess: (purchase) => {
      queryClient.setQueryData(purchaseKeys.detail(purchase.id!), purchase)
      void queryClient.invalidateQueries({ queryKey: purchaseKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory-movements'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-reports'] })
    },
    // Someone else cancelled it first, or sold its units: reload what the 409 shows is stale.
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: purchaseKeys.all })
        void queryClient.invalidateQueries({ queryKey: ['products'] })
        void queryClient.invalidateQueries({ queryKey: ['inventory-movements'] })
        void queryClient.invalidateQueries({ queryKey: ['stock-reports'] })
      }
    },
  })
}

/**
 * How many purchases were cancelled on a day (by cancellation date, whenever they were recorded), for
 * the supervision alerts; under 'purchases' so a cancellation refreshes it.
 */
export function useDayPurchaseCancellationCount(day: string, { refetchInterval, staleTime }: LiveOptions = {}) {
  return useQuery({
    queryKey: [...purchaseKeys.all, 'day-cancellations', day] as const,
    queryFn: async () => {
      const page = await unwrap(api.GET('/api/v1/purchases', {
        params: { query: { cancelledFrom: startOfDay(day), cancelledTo: dayAfter(day), size: 1 } },
      }))
      return page.page?.totalElements ?? 0
    },
    refetchInterval,
    staleTime,
  })
}

/** The API's purchases summary covers at most this many days, like the sales report. */
export const MAX_REPORT_DAYS = 366

/**
 * Totals, suppliers, top products and every day of the period, added up by the API in the store's
 * time zone (up to MAX_REPORT_DAYS); under 'purchases' so recording one refreshes it.
 */
export function usePurchaseReport(range: DayRange, supplierId: number | null, enabled = true) {
  return useQuery({
    queryKey: [...purchaseKeys.all, 'report', range, supplierId] as const,
    enabled,
    queryFn: () => unwrap(api.GET('/api/v1/purchase-reports', {
      params: { query: { ...range, supplierId: supplierId ?? undefined } },
    })),
    placeholderData: keepPreviousData,
  })
}

/** Above this many purchases the Excel report leaves the lines out; more would be hundreds of requests. */
export const MAX_DETAILED_PURCHASES = 300
const DETAIL_CONCURRENCY = 6

/** The full purchases (with lines) in the same order as ids, a few requests at a time. */
export async function fetchPurchaseDetails(ids: number[]): Promise<Purchase[]> {
  const details: Purchase[] = new Array(ids.length)
  let next = 0
  const worker = async () => {
    while (next < ids.length) {
      const index = next++
      details[index] = await unwrap(api.GET('/api/v1/purchases/{id}', { params: { path: { id: ids[index] } } }))
    }
  }
  await Promise.all(Array.from({ length: Math.min(DETAIL_CONCURRENCY, ids.length) }, worker))
  return details
}
