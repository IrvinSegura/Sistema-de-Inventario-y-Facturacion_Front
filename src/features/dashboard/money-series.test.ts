import { describe, expect, it } from 'vitest'

import { moneySeries } from './money-series'

// Local noon keeps the purchase on the same calendar day in any time zone.
const at = (day: string) => new Date(`${day}T12:00:00`).toISOString()

describe('moneySeries', () => {
  it('fills days without movements with zero', () => {
    const series = moneySeries({ from: '2026-10-01', to: '2026-10-03' },
      [{ date: '2026-10-02', total: 150.5 }], [{ purchaseDate: at('2026-10-03'), total: 80 }], 1)

    expect(series).toEqual([
      { start: '2026-10-01', end: '2026-10-01', sales: 0, purchases: 0 },
      { start: '2026-10-02', end: '2026-10-02', sales: 150.5, purchases: 0 },
      { start: '2026-10-03', end: '2026-10-03', sales: 0, purchases: 80 },
    ])
  })

  it('groups days into weeks and cuts the last one at the end of the range', () => {
    const series = moneySeries({ from: '2026-10-01', to: '2026-10-10' },
      [{ date: '2026-10-01', total: 0.1 }, { date: '2026-10-07', total: 0.2 }, { date: '2026-10-09', total: 5 }],
      [{ purchaseDate: at('2026-10-08'), total: 10 }, { purchaseDate: at('2026-10-08'), total: 2.5 }], 7)

    expect(series).toEqual([
      { start: '2026-10-01', end: '2026-10-07', sales: 0.3, purchases: 0 },
      { start: '2026-10-08', end: '2026-10-10', sales: 5, purchases: 12.5 },
    ])
  })
})
