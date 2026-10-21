import { describe, expect, it } from 'vitest'

import { effectiveSort, readSaleFilters, saleFilterParams, saleListQuery, salesLink } from './sale-params'

const TODAY = '2026-10-21'
// Midnight in Mexico City (UTC−6), where the tests' store is unless VITE_STORE_TIME_ZONE says otherwise.
const MIDNIGHT = (day: string) => expect.stringMatching(new RegExp(`^${day}T\\d{2}:00:00\\.000Z$`))

describe('readSaleFilters', () => {
  it('defaults to the sales of the last 7 days without other filters', () => {
    expect(readSaleFilters(new URLSearchParams(), TODAY)).toEqual({
      range: { from: '2026-10-15', to: TODAY },
      dateField: 'saleDate',
      saleNumber: null,
      sellerId: null,
      customerId: null,
      status: null,
    })
  })

  it('reads every filter', () => {
    const params = new URLSearchParams('from=2026-10-01&to=2026-10-20&saleNumber=1024&sellerId=7&customerId=3&status=COMPLETED')

    expect(readSaleFilters(params, TODAY)).toEqual({
      range: { from: '2026-10-01', to: '2026-10-20' },
      dateField: 'saleDate',
      saleNumber: 1024,
      sellerId: 7,
      customerId: 3,
      status: 'COMPLETED',
    })
  })

  it('only takes cancelled sales by cancellation date, whatever status the URL says', () => {
    expect(readSaleFilters(new URLSearchParams('dateField=cancelledAt&status=COMPLETED'), TODAY).status).toBe('CANCELLED')
  })

  it('takes the default for malformed values', () => {
    const filters = readSaleFilters(new URLSearchParams('from=2026-10-20&to=2026-10-01&dateField=x&sellerId=abc&status=OPEN'), TODAY)

    expect(filters).toMatchObject({ range: { from: '2026-10-15', to: TODAY }, dateField: 'saleDate', sellerId: null, status: null })
  })
})

describe('saleFilterParams', () => {
  it('round-trips the filters', () => {
    const filters = readSaleFilters(new URLSearchParams('from=2026-10-01&to=2026-10-20&dateField=cancelledAt&sellerId=7'), TODAY)

    expect(readSaleFilters(saleFilterParams(filters), TODAY)).toEqual(filters)
  })

  it('leaves out the defaults that follow from other filters', () => {
    expect(saleFilterParams({ range: { from: TODAY, to: TODAY }, dateField: 'saleDate', status: null }).toString())
      .toBe('from=2026-10-21&to=2026-10-21')
    expect(saleFilterParams({ dateField: 'cancelledAt', status: 'CANCELLED' }).toString()).toBe('dateField=cancelledAt')
  })
})

describe('saleListQuery', () => {
  const base = readSaleFilters(new URLSearchParams('from=2026-10-01&to=2026-10-20'), TODAY)

  it('filters the sale dates as instants, the last day included', () => {
    expect(saleListQuery(base)).toEqual({ from: MIDNIGHT('2026-10-01'), to: MIDNIGHT('2026-10-21') })
  })

  it('filters cancelled sales by their cancellation dates', () => {
    const query = saleListQuery({ ...base, dateField: 'cancelledAt', status: 'CANCELLED' })

    expect(query).toEqual({ status: 'CANCELLED', cancelledFrom: MIDNIGHT('2026-10-01'), cancelledTo: MIDNIGHT('2026-10-21') })
  })

  it('searches a ticket number on every date, still cancelled-only by cancellation date', () => {
    // The API sorts by cancellation date only with status=CANCELLED or a cancellation range.
    expect(saleListQuery({ ...base, dateField: 'cancelledAt', status: 'CANCELLED', saleNumber: 1024 }))
      .toEqual({ saleNumber: 1024, status: 'CANCELLED' })
  })
})

describe('effectiveSort', () => {
  it("drops a sort by the date that isn't the chosen one", () => {
    expect(effectiveSort({ field: 'cancelledAt', direction: 'desc' }, 'saleDate')).toBeNull()
    expect(effectiveSort({ field: 'saleDate', direction: 'asc' }, 'cancelledAt')).toBeNull()
  })

  it('keeps any other sort', () => {
    const byTotal = { field: 'total', direction: 'desc' } as const

    expect(effectiveSort(byTotal, 'cancelledAt')).toBe(byTotal)
    expect(effectiveSort({ field: 'cancelledAt', direction: 'desc' }, 'cancelledAt')).toEqual({ field: 'cancelledAt', direction: 'desc' })
    expect(effectiveSort(null, 'saleDate')).toBeNull()
  })
})

describe('salesLink', () => {
  it("links to a day's cancellations", () => {
    expect(salesLink({ dateField: 'cancelledAt', range: { from: TODAY, to: TODAY } }))
      .toBe('/sales?from=2026-10-21&to=2026-10-21&dateField=cancelledAt')
  })

  it('links to the plain page without filters', () => {
    expect(salesLink({})).toBe('/sales')
  })
})
