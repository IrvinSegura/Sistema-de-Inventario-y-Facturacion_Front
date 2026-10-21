import type { ReactNode } from 'react'

import { managesStore, useUser } from '@/auth/auth-context'
import { useDayClosing, useStaleDrawers } from '@/features/cash-drawer/queries'
import { useDayMovementCount, useLowStockCount } from '@/features/inventory/queries'
import { useToday } from '@/lib/use-today'

import { LIVE_QUERY_OPTIONS, LiveAlertsContext } from './live-alerts'
import { type LiveAlerts, unbalancedDrawers } from './live-day'

/**
 * Polls the live alerts once for the whole app, so the sidebar's counter and the live page share one
 * timer. Only managers can read them; for everyone else it renders the children as they are.
 */
export function LiveAlertsProvider({ children }: { children: ReactNode }) {
  const { role } = useUser()
  return managesStore(role) ? <ManagerLiveAlertsProvider>{children}</ManagerLiveAlertsProvider> : children
}

function ManagerLiveAlertsProvider({ children }: { children: ReactNode }) {
  const today = useToday()
  const state = useLiveAlerts(today)
  return <LiveAlertsContext value={{ ...state, today }}>{children}</LiveAlertsContext>
}

export type LiveAlertsState = ReturnType<typeof useLiveAlerts> & { today: string }

/**
 * The day's closing and the other queries behind the live alerts, polling every REFRESH_EVERY_MS;
 * `alerts` is there once all of them have loaded. Private: a second caller would poll on its own timer.
 */
function useLiveAlerts(today: string) {
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
