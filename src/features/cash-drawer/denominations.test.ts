import { describe, expect, it } from 'vitest'

import { cleanCount, countedTotal } from './denominations'
import { isFromPastDay } from './drawer-day'

describe('countedTotal', () => {
  it('adds every bill and coin', () => {
    expect(countedTotal({ b500: '2', b20: '1', c20: '3', c050: '3' })).toBe(1081.5)
  })

  it('treats empty counts as zero', () => {
    expect(countedTotal({})).toBe(0)
    expect(countedTotal({ b100: '' })).toBe(0)
  })

  it('does not drift with 50 cent coins', () => {
    expect(countedTotal({ c050: '7' })).toBe(3.5)
  })
})

describe('cleanCount', () => {
  it('keeps only digits', () => {
    expect(cleanCount('12')).toBe('12')
    expect(cleanCount('-3')).toBe('3')
    expect(cleanCount('1.5')).toBe('15')
    expect(cleanCount('abc')).toBe('')
  })

  it('caps the number of digits', () => {
    expect(cleanCount('1234567')).toBe('12345')
  })
})

describe('isFromPastDay', () => {
  it('flags drawers from earlier days only', () => {
    expect(isFromPastDay('2026-10-15', '2026-10-16')).toBe(true)
    expect(isFromPastDay('2026-10-16', '2026-10-16')).toBe(false)
    expect(isFromPastDay(undefined, '2026-10-16')).toBe(false)
  })
})
