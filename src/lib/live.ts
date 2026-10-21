/** Polling and freshness for queries that follow the day as it happens. */
export interface LiveOptions {
  refetchInterval?: number
  /** How long a result counts as fresh, so opening another screen with it doesn't ask again. */
  staleTime?: number
}
