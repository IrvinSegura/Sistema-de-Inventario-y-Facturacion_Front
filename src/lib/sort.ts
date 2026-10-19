// Column order of a server-paged table. The API accepts only the fields each list allows (and
// keeps its default order as a tie-breaker); null means that default order.
export type SortDirection = 'asc' | 'desc'

export interface SortState {
  field: string
  direction: SortDirection
}

// Each click on a header: its first direction (A–Z for text, largest first for amounts and
// dates), then the other one, then back to the list's default.
export function nextSort(current: SortState | null, field: string, first: SortDirection = 'asc'): SortState | null {
  if (current?.field !== field) {
    return { field, direction: first }
  }
  return current.direction === first ? { field, direction: first === 'asc' ? 'desc' : 'asc' } : null
}

// The `sort` query parameter ("stock,desc"), or nothing for the default order.
export function sortParam(sort: SortState | null | undefined): string[] | undefined {
  return sort ? [`${sort.field},${sort.direction}`] : undefined
}
