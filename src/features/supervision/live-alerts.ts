import { useDayClosing, useStaleDrawers } from '@/features/cash-drawer/queries'
import { useDayMovementCount, useLowStockCount } from '@/features/inventory/queries'

import { type LiveAlerts, unbalancedDrawers } from './live-day'

// Keep in step with supervision.live.updatedAt, which tells the user how often it refreshes.
export const REFRESH_EVERY_MS = 60_000
// Fresh for half the period: moving between screens doesn't ask again, the polling still does.
export const LIVE_QUERY_OPTIONS = { refetchInterval: REFRESH_EVERY_MS, staleTime: REFRESH_EVERY_MS / 2 }

/**
 * The day's closing and the other queries behind the live alerts, polling every REFRESH_EVERY_MS;
 * `alerts` is there once all of them have loaded.
 */
export function useLiveAlerts(today: string) {
  // Same keys for the live page and the sidebar's counter, so they share the cached results.
  const day = useDayClosing(today, LIVE_QUERY_OPTIONS)
  const staleDrawers = useStaleDrawers(today, LIVE_QUERY_OPTIONS)
  const lowStock = useLowStockCount(LIVE_QUERY_OPTIONS)
  const adjustments = useDayMovementCount('ADJUSTMENT', today, LIVE_QUERY_OPTIONS)

  const alerts: LiveAlerts | undefined =
    day.data && staleDrawers.data && lowStock.data !== undefined && adjustments.data !== undefined
      ? {
        stale: staleDrawers.data,
        unbalanced: unbalancedDrawers(day.data),
        lowStockCount: lowStock.data,
        adjustmentCount: adjustments.data,
      }
      : undefined

  return {
    day,
    staleDrawers,
    alerts,
    // The day's own error shows separately, next to its figures.
    alertsError: staleDrawers.error ?? lowStock.error ?? adjustments.error,
    isFetching: day.isFetching || staleDrawers.isFetching || lowStock.isFetching || adjustments.isFetching,
    refetch: () => Promise.all([day.refetch(), staleDrawers.refetch(), lowStock.refetch(), adjustments.refetch()]),
  }
}
