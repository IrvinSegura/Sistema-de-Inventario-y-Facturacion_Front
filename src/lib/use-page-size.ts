import { useState } from 'react'

export const PAGE_SIZES = [10, 20, 50, 100] as const
const DEFAULT_PAGE_SIZE = 20

function storageKey(table: string) {
  return `inventory.pageSize.${table}`
}

// Rows per page of one table, remembered per browser (the API pages at most 100).
export function usePageSize(table: string): [number, (size: number) => void] {
  const [size, setSize] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey(table)))
      return (PAGE_SIZES as readonly number[]).includes(saved) ? saved : DEFAULT_PAGE_SIZE
    } catch {
      return DEFAULT_PAGE_SIZE
    }
  })
  return [size, (next: number) => {
    setSize(next)
    try {
      localStorage.setItem(storageKey(table), String(next))
    } catch {
      // Storage blocked: the choice only lasts for this visit.
    }
  }]
}
