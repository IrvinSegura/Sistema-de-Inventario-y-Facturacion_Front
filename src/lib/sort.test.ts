import { describe, expect, it } from 'vitest'

import { nextSort, sortParam } from './sort'

describe('nextSort', () => {
  it('cycles through the first direction, the other one and the default order', () => {
    const first = nextSort(null, 'name')
    expect(first).toEqual({ field: 'name', direction: 'asc' })
    const second = nextSort(first, 'name')
    expect(second).toEqual({ field: 'name', direction: 'desc' })
    expect(nextSort(second, 'name')).toBeNull()
  })

  it('starts amounts and dates from the largest', () => {
    const first = nextSort(null, 'total', 'desc')
    expect(first).toEqual({ field: 'total', direction: 'desc' })
    expect(nextSort(first, 'total', 'desc')).toEqual({ field: 'total', direction: 'asc' })
  })

  it('switching to another column starts over', () => {
    expect(nextSort({ field: 'name', direction: 'desc' }, 'stock', 'desc')).toEqual({ field: 'stock', direction: 'desc' })
  })
})

describe('sortParam', () => {
  it('formats the API parameter', () => {
    expect(sortParam({ field: 'stock', direction: 'desc' })).toEqual(['stock,desc'])
    expect(sortParam(null)).toBeUndefined()
  })
})
