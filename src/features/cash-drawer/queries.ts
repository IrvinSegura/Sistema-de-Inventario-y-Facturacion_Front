import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from '@/api/client'
import { ApiError } from '@/api/errors'

export type CashDrawer = Schemas['CashDrawerResponse']

export const drawerKeys = {
  current: ['cash-drawers', 'current'] as const,
  latest: ['cash-drawers', 'latest'] as const,
}

// The user's open drawer, or null when none is open (the API answers 404).
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

// The user's most recent drawer (newest business day first), to show the last closing.
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

export function useOpenDrawer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (openingFloat: number) =>
      unwrap(api.POST('/api/v1/cash-drawers', { body: { openingFloat } })),
    onSuccess: (drawer) => {
      queryClient.setQueryData(drawerKeys.current, drawer)
      void queryClient.invalidateQueries({ queryKey: drawerKeys.latest })
    },
  })
}

export function useCloseDrawer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, countedCash, note }: { id: number; countedCash: number; note?: string }) =>
      unwrap(api.POST('/api/v1/cash-drawers/{id}/closing', {
        params: { path: { id } },
        body: { countedCash, note },
      })),
    onSuccess: (drawer) => {
      queryClient.setQueryData(drawerKeys.current, null)
      queryClient.setQueryData(drawerKeys.latest, drawer)
    },
  })
}
