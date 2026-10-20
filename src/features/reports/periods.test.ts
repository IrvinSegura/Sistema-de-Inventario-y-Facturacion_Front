import { describe, expect, it } from 'vitest'

import { buckets, centsByDay, change, comparisonSeries, defaultGrouping, flowSeries, previousRange } from './periods'

describe('previousRange', () => {
  it('is the same number of days right before the range', () => {
    expect(previousRange({ from: '2026-10-01', to: '2026-10-31' })).toEqual({ from: '2026-08-31', to: '2026-09-30' })
    expect(previousRange({ from: '2026-10-19', to: '2026-10-19' })).toEqual({ from: '2026-10-18', to: '2026-10-18' })
  })

  it('crosses a year boundary', () => {
    expect(previousRange({ from: '2026-01-01', to: '2026-01-07' })).toEqual({ from: '2025-12-25', to: '2025-12-31' })
  })
})

describe('change', () => {
  it('is a fraction of the previous value', () => {
    expect(change(150, 100)).toBe(0.5)
    expect(change(50, 100)).toBe(-0.5)
  })

  it('has no percentage when growing from zero', () => {
    expect(change(10, 0)).toBeNull()
    expect(change(0, 0)).toBe(0)
  })

  it('keeps the sign right for negative previous values', () => {
    expect(change(-50, -100)).toBe(0.5)
  })
})

describe('defaultGrouping', () => {
  it('picks days, weeks or months by length', () => {
    expect(defaultGrouping({ from: '2026-10-01', to: '2026-10-31' })).toBe('day')
    expect(defaultGrouping({ from: '2026-07-01', to: '2026-10-19' })).toBe('week')
    expect(defaultGrouping({ from: '2026-01-01', to: '2026-10-19' })).toBe('month')
  })
})

describe('buckets', () => {
  it('splits into calendar weeks from Monday to Sunday, cut to the range', () => {
    // 2026-10-01 is a Thursday.
    expect(buckets({ from: '2026-10-01', to: '2026-10-14' }, 'week')).toEqual([
      { start: '2026-10-01', end: '2026-10-04' },
      { start: '2026-10-05', end: '2026-10-11' },
      { start: '2026-10-12', end: '2026-10-14' },
    ])
  })

  it('splits into calendar months, leap years included', () => {
    expect(buckets({ from: '2028-01-15', to: '2028-03-02' }, 'month')).toEqual([
      { start: '2028-01-15', end: '2028-01-31' },
      { start: '2028-02-01', end: '2028-02-29' },
      { start: '2028-03-01', end: '2028-03-02' },
    ])
  })

  it('has one bucket per day', () => {
    expect(buckets({ from: '2026-10-30', to: '2026-11-01' }, 'day').map((bucket) => bucket.start))
      .toEqual(['2026-10-30', '2026-10-31', '2026-11-01'])
  })
})

describe('comparisonSeries', () => {
  it('reads the same days of the previous period', () => {
    const current = centsByDay([{ date: '2026-10-02', total: 10 }], (row) => row.date, (row) => row.total)
    const previous = centsByDay([{ date: '2026-09-29', total: 0.1 }, { date: '2026-09-30', total: 0.2 }],
      (row) => row.date, (row) => row.total)

    expect(comparisonSeries({ from: '2026-10-01', to: '2026-10-03' }, 'day', current, previous)).toEqual([
      { start: '2026-10-01', end: '2026-10-01', current: 0, previous: 0 },
      { start: '2026-10-02', end: '2026-10-02', current: 10, previous: 0.1 },
      { start: '2026-10-03', end: '2026-10-03', current: 0, previous: 0.2 },
    ])
  })
})

describe('flowSeries', () => {
  it('nets sales against purchases and carries the running total', () => {
    const sales = centsByDay([{ day: '2026-10-01', total: 100.1 }, { day: '2026-10-02', total: 50 }],
      (row) => row.day, (row) => row.total)
    const purchases = centsByDay([{ day: '2026-10-02', total: 80.2 }], (row) => row.day, (row) => row.total)

    expect(flowSeries({ from: '2026-10-01', to: '2026-10-02' }, 'day', sales, purchases)).toEqual([
      { start: '2026-10-01', end: '2026-10-01', sales: 100.1, purchases: 0, net: 100.1, cumulative: 100.1 },
      { start: '2026-10-02', end: '2026-10-02', sales: 50, purchases: 80.2, net: -30.2, cumulative: 69.9 },
    ])
  })
})
