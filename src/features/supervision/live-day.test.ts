import { describe, expect, it } from 'vitest'

import type { CashDrawer } from '@/features/cash-drawer/queries'

import { ALERT_MIN_DIFFERENCE, averageTicket, sellerDays, unbalancedDrawers } from './live-day'

const ana = { id: 1, name: 'Ana' }
const luis = { id: 2, name: 'Luis' }
const marta = { id: 3, name: 'Marta' }

function amounts(salesTotal: number, saleCount: number) {
  return { salesTotal, saleCount, cancellationCount: 0, cancellationsTotal: 0, net: salesTotal }
}

function closedDrawer(id: number, difference: number): CashDrawer {
  return { id, members: [ana], closing: { difference } }
}

describe('sellerDays', () => {
  it('lists every drawer member, with or without sales, best seller first', () => {
    const shared: CashDrawer = { id: 1, members: [ana, luis] }

    const days = sellerDays({ drawers: [shared], bySeller: [{ seller: luis, total: amounts(300, 2) }] })

    expect(days.map((day) => day.seller.name)).toEqual(['Luis', 'Ana'])
    expect(days[0]).toMatchObject({ drawer: shared, amounts: { salesTotal: 300 } })
    expect(days[1].amounts).toBeUndefined()
  })

  it('keeps a seller with figures but no drawer today', () => {
    const days = sellerDays({ drawers: [], bySeller: [{ seller: marta, total: amounts(0, 0) }] })

    expect(days).toEqual([{ seller: marta, drawer: undefined, amounts: amounts(0, 0) }])
  })

  it('orders sellers without sales by name', () => {
    const days = sellerDays({ drawers: [{ id: 1, members: [marta] }, { id: 2, members: [ana] }] })

    expect(days.map((day) => day.seller.name)).toEqual(['Ana', 'Marta'])
  })

  it('shows a seller in two drawers with the first one', () => {
    const days = sellerDays({ drawers: [{ id: 1, members: [ana] }, { id: 2, members: [ana, luis] }] })

    expect(days.find((day) => day.seller.id === ana.id)?.drawer?.id).toBe(1)
  })

  it('skips figures without a seller', () => {
    expect(sellerDays({ drawers: [], bySeller: [{ total: amounts(100, 1) }] })).toEqual([])
  })
})

describe('averageTicket', () => {
  it('divides the sales by the tickets', () => {
    expect(averageTicket(amounts(300, 4))).toBe(75)
  })

  it('is zero without sales', () => {
    expect(averageTicket(amounts(0, 0))).toBe(0)
    expect(averageTicket(undefined)).toBe(0)
  })
})

describe('unbalancedDrawers', () => {
  it('flags shortages and surpluses from the threshold up, the largest first', () => {
    const drawers = [
      closedDrawer(1, -ALERT_MIN_DIFFERENCE), closedDrawer(2, ALERT_MIN_DIFFERENCE - 0.01), closedDrawer(3, 120), { id: 4 },
    ]

    expect(unbalancedDrawers(drawers).map(({ drawer, difference }) => [drawer.id, difference]))
      .toEqual([[3, 120], [1, -ALERT_MIN_DIFFERENCE]])
  })
})
