import { describe, expect, it } from 'vitest'

import {
  type DraftLine,
  draftReducer,
  draftTotals,
  lineSubtotal,
  margin,
  MAX_LINES,
  parseQuantity,
  parseUnitCost,
} from './purchase-draft'

const rice = { productId: 1, sku: 'ARROZ-1', name: 'Arroz 1 kg', stock: 4, salePrice: 32 }
const beans = { productId: 2, sku: 'FRIJOL-1', name: 'Frijol 1 kg', stock: 0 }

describe('draftReducer', () => {
  it('adds a product once and counts repeated additions as more units', () => {
    let lines = draftReducer([], { type: 'add', line: rice })
    lines = draftReducer(lines, { type: 'add', line: rice })
    expect(lines).toHaveLength(1)
    expect(lines[0].quantity).toBe('2')
    expect(lines[0].unitCost).toBe('')
  })

  it('keeps the quantity and cost a line comes with', () => {
    const lines = draftReducer([], { type: 'add', line: { ...beans, quantity: '12', unitCost: '18.50' } })
    expect(lines[0]).toMatchObject({ quantity: '12', unitCost: '18.50' })
  })

  it('updates and removes lines by product', () => {
    let lines = draftReducer([], { type: 'add', line: rice })
    lines = draftReducer(lines, { type: 'add', line: beans })
    lines = draftReducer(lines, { type: 'update', productId: 2, field: 'unitCost', value: '20' })
    expect(lines[1].unitCost).toBe('20')
    lines = draftReducer(lines, { type: 'remove', productId: 1 })
    expect(lines.map((line) => line.productId)).toEqual([2])
    expect(draftReducer(lines, { type: 'clear' })).toEqual([])
  })

  it('stops at the API limit of lines', () => {
    const full: DraftLine[] = Array.from({ length: MAX_LINES }, (_, index) =>
      ({ ...beans, productId: index + 10, quantity: '1', unitCost: '1' }))
    expect(draftReducer(full, { type: 'add', line: rice })).toBe(full)
  })
})

describe('parsing', () => {
  it('accepts whole quantities within the API limits', () => {
    expect(parseQuantity('3')).toBe(3)
    expect(parseQuantity('0')).toBeNull()
    expect(parseQuantity('1.5')).toBeNull()
    expect(parseQuantity('100001')).toBeNull()
  })

  it('accepts costs with up to two decimals', () => {
    expect(parseUnitCost('0')).toBe(0)
    expect(parseUnitCost('12.5')).toBe(12.5)
    expect(parseUnitCost('12.555')).toBeNull()
    expect(parseUnitCost('-1')).toBeNull()
    expect(parseUnitCost('100000')).toBeNull()
  })
})

describe('totals', () => {
  it('adds lines in cents and skips incomplete ones', () => {
    const lines: DraftLine[] = [
      { ...rice, quantity: '3', unitCost: '0.10' },
      { ...beans, quantity: '1', unitCost: '0.20' },
      { ...beans, productId: 3, quantity: '2', unitCost: '' },
    ]
    expect(draftTotals(lines)).toEqual({ validLines: 2, units: 4, total: 0.5 })
    expect(lineSubtotal(lines[0])).toBe(0.3)
    expect(lineSubtotal(lines[2])).toBeNull()
  })

  it('computes the margin against the sale price', () => {
    expect(margin({ ...rice, quantity: '1', unitCost: '24' })).toBe(0.25)
    expect(margin({ ...beans, quantity: '1', unitCost: '24' })).toBeNull()
  })
})
