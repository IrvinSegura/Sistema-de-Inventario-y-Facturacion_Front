import type { ReactNode } from 'react'

import { managesStore, useUser } from '@/auth/auth-context'
import { useDayClosing, useStaleDrawers } from '@/features/cash-drawer/queries'
import { useDayMovementCount, useLowStockCount } from '@/features/inventory/queries'
import { useDayPurchaseCancellationCount } from '@/features/purchases/queries'
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
  const purchaseCancellations = useDayPurchaseCancellationCount(today, LIVE_QUERY_OPTIONS)
  const alertQueries = [staleDrawers, lowStock, adjustments, purchaseCancellations]

  const alerts: LiveAlerts | undefined =
    day.data && staleDrawers.data && lowStock.data !== undefined && adjustments.data !== undefined
      && purchaseCancellations.data !== undefined
      ? {
        stale: staleDrawers.data,
        unbalanced: unbalancedDrawers(day.data),
        lowStockCount: lowStock.data,
        adjustmentCount: adjustments.data,
        purchaseCancellationCount: purchaseCancellations.data,
      }
      : undefined

  return {
    day,
    staleDrawers,
    alerts,
    // The day's own error shows separately, next to its figures.
    alertsError: alertQueries.find((query) => query.error)?.error ?? null,
    isFetching: day.isFetching || alertQueries.some((query) => query.isFetching),
    refetch: () => Promise.all([day, ...alertQueries].map((query) => query.refetch())),
  }
}
