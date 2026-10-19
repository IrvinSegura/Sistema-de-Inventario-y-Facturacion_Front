import { describe, expect, it } from 'vitest'

import { isInvoiceable, isTaxRegimeCode, regimeAppliesTo } from './tax-regimes'

describe('tax regimes', () => {
  it('knows only SAT codes', () => {
    expect(isTaxRegimeCode('601')).toBe(true)
    expect(isTaxRegimeCode('999')).toBe(false)
  })

  it('applies a regime by the tax ID length', () => {
    expect(regimeAppliesTo('601', 'ABC010203XY1')).toBe(true)
    expect(regimeAppliesTo('601', 'ABCD010203XY1')).toBe(false)
    expect(regimeAppliesTo('605', 'ABCD010203XY1')).toBe(true)
    expect(regimeAppliesTo('605', 'ABC010203XY1')).toBe(false)
    expect(regimeAppliesTo('626', 'ABC010203XY1')).toBe(true)
    expect(regimeAppliesTo('626', 'ABCD010203XY1')).toBe(true)
  })

  it('needs the tax ID, the postal code and the regime to invoice', () => {
    expect(isInvoiceable({ taxId: 'ABC010203XY1', fiscalPostalCode: '06600', taxRegime: '601' })).toBe(true)
    expect(isInvoiceable({ taxId: 'ABC010203XY1' })).toBe(false)
    expect(isInvoiceable({})).toBe(false)
  })
})
