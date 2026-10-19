import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from '@/api/client'
import { ApiError } from '@/api/errors'
import { type SortState, sortParam } from '@/lib/sort'

export type CashDrawer = Schemas['CashDrawerResponse']
export type CashClosing = Schemas['CashClosingResponse']
export type SaleSummary = Schemas['SaleSummaryResponse']
export type AssignableSeller = Schemas['AssignableSellerResponse']

export interface AssignedDrawer {
  openingFloat: number
  memberIds: number[]
  responsibleId: number
}

export const HISTORY_PAGE_SIZE = 20
// The API pages at most 100 items: enough for one drawer's tickets.
const MAX_PAGE_SIZE = 100

export interface DrawerSearch {
  from?: string
  to?: string
  // Drawers this seller was in.
  sellerId?: number
}

export const drawerKeys = {
  all: ['cash-drawers'] as const,
  current: ['cash-drawers', 'current'] as const,
  latest: ['cash-drawers', 'latest'] as const,
  search: (search: DrawerSearch, page: number, size: number, sort: SortState | null) =>
    ['cash-drawers', 'search', search, page, size, sort] as const,
  assignable: ['cash-drawers', 'assignable-sellers'] as const,
  // Under 'sale-reports' so a sale or cancellation anywhere refreshes the closings too.
  dayClosing: (date: string, sellerId?: number) => ['sale-reports', 'cash-closing', date, sellerId ?? 'all'] as const,
  drawerClosing: (drawerId: number) => ['sale-reports', 'cash-closing', 'drawer', drawerId] as const,
  drawerSales: (drawerId: number) => ['sales', 'drawer', drawerId] as const,
  sale: (id: number) => ['sales', 'detail', id] as const,
}

// The open drawer the user is in (their own or one a manager assigned), or null when none is open
// (the API answers 404).
export function useCurrentDrawer() {
  return useQuery({
    queryKey: drawerKeys.current,
    queryFn: async (): Promise<CashDrawer | null> => {
      try {
        return await unwrap(api.GET('/api/v1/cash-drawers/current'))
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null
        }
        throw error
      }
    },
  })
}

// The most recent drawer the user was in (newest business day first), to show the last closing.
export function useLatestDrawer(enabled: boolean) {
  return useQuery({
    queryKey: drawerKeys.latest,
    enabled,
    queryFn: async () => {
      const page = await unwrap(api.GET('/api/v1/cash-drawers', { params: { query: { size: 1 } } }))
      return page.content?.[0] ?? null
    },
  })
}

// Drawers by business day, newest first; sellers only get the ones they were in.
export function useDrawers(search: DrawerSearch, page: number, size = HISTORY_PAGE_SIZE, sort: SortState | null = null) {
  return useQuery({
    queryKey: drawerKeys.search(search, page, size, sort),
    queryFn: () => unwrap(api.GET('/api/v1/cash-drawers', { params: { query: { ...search, page, size, sort: sortParam(sort) } } })),
    placeholderData: keepPreviousData,
  })
}

// One day by payment method, plus that day's drawers. Without sellerId (managers only) it covers
// the whole store; a seller gets their own only once their drawer is closed (409 before).
export function useDayClosing(date: string, sellerId?: number) {
  return useQuery({
    queryKey: drawerKeys.dayClosing(date, sellerId),
    queryFn: () => unwrap(api.GET('/api/v1/sale-reports/cash-closing', { params: { query: { date, sellerId } } })),
  })
}

// One drawer by payment method and by seller: its sales and the refunds that came out of it.
// Members get it only once the drawer is closed (409 before); managers any time.
export function useDrawerClosing(drawerId: number) {
  return useQuery({
    queryKey: drawerKeys.drawerClosing(drawerId),
    queryFn: () => unwrap(api.GET('/api/v1/sale-reports/cash-closing', { params: { query: { cashDrawerId: drawerId } } })),
  })
}

// The tickets recorded in a drawer, newest first, cancelled ones included; a seller only gets their own.
export function useDrawerSales(drawerId: number) {
  return useQuery({
    queryKey: drawerKeys.drawerSales(drawerId),
    queryFn: async () => {
      const page = await unwrap(api.GET('/api/v1/sales', {
        params: { query: { cashDrawerId: drawerId, size: MAX_PAGE_SIZE } },
      }))
      return page.content ?? []
    },
  })
}

// Active sellers without a drawer today (nor one left open), for managers to assign one.
export function useAssignableSellers() {
  return useQuery({
    queryKey: drawerKeys.assignable,
    queryFn: () => unwrap(api.GET('/api/v1/cash-drawers/assignable-sellers')),
  })
}

export function useSale(id: number | null) {
  return useQuery({
    queryKey: drawerKeys.sale(id ?? 0),
    enabled: id !== null,
    queryFn: () => unwrap(api.GET('/api/v1/sales/{id}', { params: { path: { id: id! } } })),
  })
}

export function useOpenDrawer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (openingFloat: number) =>
      unwrap(api.POST('/api/v1/cash-drawers', { body: { openingFloat } })),
    onSuccess: (drawer) => {
      queryClient.setQueryData(drawerKeys.current, drawer)
      void queryClient.invalidateQueries({ queryKey: drawerKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['sale-reports'] })
    },
  })
}

// Managers open a drawer for one seller or a shared one for several, and hand over the float.
export function useOpenAssignedDrawer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: AssignedDrawer) => unwrap(api.POST('/api/v1/cash-drawers/assigned', { body })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: drawerKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['sale-reports'] })
    },
  })
}

// The drawer's responsible closes it; admins and supervisors can close anyone's.
export function useCloseDrawer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, countedCash, note }: { id: number; countedCash: number; note?: string }) =>
      unwrap(api.POST('/api/v1/cash-drawers/{id}/closing', {
        params: { path: { id } },
        body: { countedCash, note },
      })),
    onSuccess: (drawer) => {
      if (queryClient.getQueryData<CashDrawer | null>(drawerKeys.current)?.id === drawer.id) {
        queryClient.setQueryData(drawerKeys.current, null)
        queryClient.setQueryData(drawerKeys.latest, drawer)
      }
      void queryClient.invalidateQueries({ queryKey: drawerKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['sale-reports'] })
    },
  })
}

// Admins and supervisors only; the sale's stock goes back and the refund counts in today's closing.
export function useCancelSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      unwrap(api.POST('/api/v1/sales/{id}/cancellation', { params: { path: { id } }, body: { reason } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sales'] })
      void queryClient.invalidateQueries({ queryKey: ['sale-reports'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory-movements'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-reports'] })
    },
  })
}
