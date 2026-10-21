import { describe, expect, it } from 'vitest'

import { compactParams, readDay, readOption, readPositiveInt, readRange } from './search-params'

const TODAY = '2026-10-21'

describe('readDay', () => {
  it('accepts a real day up to today', () => {
    expect(readDay('2026-10-21', TODAY)).toBe('2026-10-21')
    expect(readDay('2000-01-01', TODAY)).toBe('2000-01-01')
  })

  it('rejects missing, malformed, impossible and out-of-bounds days', () => {
    expect(readDay(null, TODAY)).toBeNull()
    expect(readDay('2026-1-5', TODAY)).toBeNull()
    expect(readDay('2026-02-30', TODAY)).toBeNull()
    expect(readDay('1999-12-31', TODAY)).toBeNull()
    expect(readDay('2026-10-22', TODAY)).toBeNull()
  })
})

describe('readRange', () => {
  it('reads a forward range', () => {
    expect(readRange(new URLSearchParams('from=2026-10-01&to=2026-10-21'), TODAY)).toEqual({ from: '2026-10-01', to: '2026-10-21' })
  })

  it('rejects a backward range, a missing end and one longer than maxDays', () => {
    expect(readRange(new URLSearchParams('from=2026-10-21&to=2026-10-01'), TODAY)).toBeNull()
    expect(readRange(new URLSearchParams('from=2026-10-01'), TODAY)).toBeNull()
    expect(readRange(new URLSearchParams('from=2026-10-01&to=2026-10-21'), TODAY, 20)).toBeNull()
    expect(readRange(new URLSearchParams('from=2026-10-02&to=2026-10-21'), TODAY, 20)).not.toBeNull()
  })
})

describe('readPositiveInt', () => {
  it('reads positive whole numbers only', () => {
    expect(readPositiveInt('42')).toBe(42)
    expect(readPositiveInt('0')).toBeNull()
    expect(readPositiveInt('-3')).toBeNull()
    expect(readPositiveInt('1.5')).toBeNull()
    expect(readPositiveInt('1e3')).toBeNull()
    expect(readPositiveInt('99999999999999999999')).toBeNull()
    expect(readPositiveInt(null)).toBeNull()
  })
})

describe('readOption', () => {
  it('reads one of the options', () => {
    expect(readOption('SALE', ['SALE', 'ADJUSTMENT'] as const)).toBe('SALE')
    expect(readOption('sale', ['SALE', 'ADJUSTMENT'] as const)).toBeNull()
  })
})

describe('compactParams', () => {
  it('leaves out the empty values', () => {
    expect(compactParams({ a: '1', b: null, c: undefined, d: '', e: 0 }).toString()).toBe('a=1&e=0')
  })
})
