import { describe, expect, it } from 'vitest'

import { movementParams, movementsLink, readMovementParams } from './movement-params'

const TODAY = '2026-10-21'

describe('readMovementParams', () => {
  it("reads a product's ledger, all dates unless filtered", () => {
    expect(readMovementParams(new URLSearchParams('productId=5&type=SALE'), TODAY))
      .toMatchObject({ productId: 5, type: 'SALE', storeWide: false, range: null })
  })

  it('lists the whole store for a type alone, over the default range when the URL has none', () => {
    const read = readMovementParams(new URLSearchParams('type=ADJUSTMENT'), TODAY)

    expect(read).toMatchObject({ productId: null, storeWide: true, range: { from: '2026-09-22', to: TODAY } })
    // The default stays out of the URL, so it keeps following today.
    expect(read.chosen.range).toBeNull()
  })

  it('caps the store-wide range at 366 days, but not a product ledger', () => {
    const year = 'from=2025-10-20&to=2026-10-21'

    expect(readMovementParams(new URLSearchParams(`type=SALE&${year}`), TODAY).chosen.range).toBeNull()
    expect(readMovementParams(new URLSearchParams(`productId=5&type=SALE&${year}`), TODAY).range)
      .toEqual({ from: '2025-10-20', to: TODAY })
  })

  it('is neither a ledger nor store-wide without a product or a type', () => {
    expect(readMovementParams(new URLSearchParams('type=OTHER&productId=x'), TODAY))
      .toMatchObject({ productId: null, type: null, storeWide: false, range: null })
  })
})

describe('movementParams', () => {
  it('leaves the empty filters out', () => {
    expect(movementParams({ productId: null, type: 'SALE', range: null }).toString()).toBe('type=SALE')
  })
})

describe('movementsLink', () => {
  it("links to a day's adjustments", () => {
    expect(movementsLink({ type: 'ADJUSTMENT', range: { from: TODAY, to: TODAY } }))
      .toBe('/inventory/movements?type=ADJUSTMENT&from=2026-10-21&to=2026-10-21')
  })

  it("links to a product's ledger", () => {
    expect(movementsLink({ productId: 5 })).toBe('/inventory/movements?productId=5')
  })
})
