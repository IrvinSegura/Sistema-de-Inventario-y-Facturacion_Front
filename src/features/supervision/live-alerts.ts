import { createContext, use } from 'react'

import type { LiveAlertsState } from './LiveAlertsProvider'

// Keep in step with supervision.live.updatedAt, which tells the user how often it refreshes.
export const REFRESH_EVERY_MS = 60_000
// Fresh for half the period: moving between screens doesn't ask again, the polling still does.
export const LIVE_QUERY_OPTIONS = { refetchInterval: REFRESH_EVERY_MS, staleTime: REFRESH_EVERY_MS / 2 }

/** Set by LiveAlertsProvider for managers; null for everyone else. */
export const LiveAlertsContext = createContext<LiveAlertsState | null>(null)

/** The shared live alerts; only under LiveAlertsProvider (the manager-only screens are). */
export function useSharedLiveAlerts(): LiveAlertsState {
  const state = use(LiveAlertsContext)
  if (!state) {
    throw new Error('useSharedLiveAlerts must be used under LiveAlertsProvider, for managers')
  }
  return state
}
