import { describe, expect, it } from 'vitest'

import { lineTaxCents, toCents, withTax } from './money'

describe('lineTaxCents', () => {
  it('rounds half up to cents, like the API', () => {
    // 10.05 * 0.16 = 1.608 -> 1.61
    expect(lineTaxCents(1005, 0.16)).toBe(161)
    // 0.25 * 0.16 = 0.04 exactly
    expect(lineTaxCents(25, 0.16)).toBe(4)
    // 0.50 * 0.05 = 0.025 -> 0.03 (half up, not half even)
    expect(lineTaxCents(50, 0.05)).toBe(3)
  })

  it('ignores floating point noise', () => {
    // 1005 * 0.16 is 160.79999999999998 in floating point.
    expect(lineTaxCents(1005, 0.16)).toBe(161)
    expect(lineTaxCents(1850, 0)).toBe(0)
  })
})

describe('toCents', () => {
  it('avoids binary fractions', () => {
    expect(toCents(0.1) + toCents(0.2)).toBe(30)
    expect(toCents(32.5)).toBe(3250)
  })
})

describe('withTax', () => {
  it('adds the VAT rounded like a one-unit sale line', () => {
    expect(withTax(10.05, 0.16)).toBe(11.66)
    expect(withTax(18.5, 0)).toBe(18.5)
    expect(withTax(0.5, 0.05)).toBe(0.53)
  })
})
