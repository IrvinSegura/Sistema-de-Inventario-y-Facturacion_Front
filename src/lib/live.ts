// Keep in step with supervision.live.updatedAt, which tells the user how often it refreshes.
export const LIVE_REFRESH_MS = 60_000
// Fresh for half the period: moving between screens doesn't ask again, the polling still does.
export const LIVE_QUERY_OPTIONS = { refetchInterval: LIVE_REFRESH_MS, staleTime: LIVE_REFRESH_MS / 2 }

/** Polling and freshness for queries that follow the day as it happens. */
export interface LiveOptions {
  refetchInterval?: number
  /** How long a result counts as fresh, so opening another screen with it doesn't ask again. */
  staleTime?: number
}
