export type SortDirection = 'asc' | 'desc'

/**
 * Column order of a server-paged table. The API accepts only the fields each list allows (and
 * keeps its default order as a tie-breaker); null means that default order.
 */
export interface SortState {
  field: string
  direction: SortDirection
}

/**
 * Each click on a header: its first direction (`first`: 'asc' for A–Z text, 'desc' for largest first
 * in amounts and dates), then the other one, then back to the list's default (null). Another column
 * starts over.
 */
export function nextSort(current: SortState | null, field: string, first: SortDirection = 'asc'): SortState | null {
  if (current?.field !== field) {
    return { field, direction: first }
  }
  return current.direction === first ? { field, direction: first === 'asc' ? 'desc' : 'asc' } : null
}

/** The `sort` query parameter ("stock,desc"), or nothing for the default order. */
export function sortParam(sort: SortState | null | undefined): string[] | undefined {
  return sort ? [`${sort.field},${sort.direction}`] : undefined
}
