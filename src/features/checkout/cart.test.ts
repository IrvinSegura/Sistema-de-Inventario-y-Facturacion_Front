import { describe, expect, it } from 'vitest'

import { type CartLine, cartReducer, cartTotals } from './cart'

const rice = { productId: 1, sku: 'RICE-1KG', name: 'Rice', unitPrice: 32.5, taxRate: 0, stock: 10 }
const cola = { productId: 3, sku: 'COLA-600', name: 'Cola', unitPrice: 18.5, taxRate: 0.16, stock: 10 }

describe('cartReducer', () => {
  it('adds one unit when a product is scanned again instead of a second line', () => {
    let lines: CartLine[] = cartReducer([], { type: 'add', line: rice })
    lines = cartReducer(lines, { type: 'add', line: rice })
    expect(lines).toEqual([{ ...rice, quantity: 2 }])
  })

  it('removes the line when its quantity drops below one', () => {
    const lines = cartReducer([{ ...rice, quantity: 1 }], { type: 'setQuantity', productId: 1, quantity: 0 })
    expect(lines).toEqual([])
  })
})

describe('cartTotals', () => {
  it('computes VAT per line and adds it to the subtotal', () => {
    // Rice 2 x 32.50 (0%) + Cola 3 x 18.50 = 55.50 (16% -> 8.88).
    const totals = cartTotals([{ ...rice, quantity: 2 }, { ...cola, quantity: 3 }])
    expect(totals).toEqual({ subtotal: 120.5, tax: 8.88, total: 129.38 })
  })
})
