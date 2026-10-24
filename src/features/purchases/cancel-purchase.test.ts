// @vitest-environment jsdom
// jsdom: ApiError loads i18n, which touches document.
import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api/errors'

import { soldOutLine } from './cancel-purchase'
import type { Purchase } from './queries'

const purchase: Purchase = {
  id: 7,
  items: [
    { productId: 3, name: 'Rice', quantity: 4 },
    { productId: 12, name: 'Soap', quantity: 2 },
  ],
}

describe('soldOutLine', () => {
  it('finds the line the API named', () => {
    const error = new ApiError(409, { detail: 'Insufficient stock for product: 12' })
    expect(soldOutLine(error, purchase)?.name).toBe('Soap')
  })

  it('ignores products that are not in the purchase', () => {
    const error = new ApiError(409, { detail: 'Insufficient stock for product: 99' })
    expect(soldOutLine(error, purchase)).toBeUndefined()
  })

  it('ignores other errors', () => {
    expect(soldOutLine(new ApiError(409, { detail: 'Purchase is already cancelled' }), purchase)).toBeUndefined()
    expect(soldOutLine(new ApiError(400, { detail: 'Insufficient stock for product: 3' }), purchase)).toBeUndefined()
    expect(soldOutLine(new TypeError('Failed to fetch'), purchase)).toBeUndefined()
  })
})
