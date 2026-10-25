import { createContext, use } from 'react'

import type { LiveAlertsState } from './LiveAlertsProvider'

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
