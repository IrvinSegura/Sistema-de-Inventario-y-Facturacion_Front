import type { Schemas } from '@/api/client'
import type { CashClosing, CashDrawer } from '@/features/cash-drawer/queries'

type Ref = Schemas['Ref']
type Amounts = Schemas['Amounts']

/** Closing difference in pesos, shortage or surplus, from which a drawer raises an alert. */
export const ALERT_MIN_DIFFERENCE = 50

/** A seller's day so far: the drawer they sell from and their figures. */
export interface SellerDay {
  seller: Ref
  /** Today's drawer they sell from; none when they only have cancellations of older sales today. */
  drawer?: CashDrawer
  /** Absent when the day's closing has no figures for them yet. */
  amounts?: Amounts
}

/**
 * Everyone in today's drawers plus anyone with figures today, best seller first (by sales total,
 * then by name). A seller in two drawers shows with the first one.
 */
export function sellerDays(closing: CashClosing): SellerDay[] {
  const days = new Map<number, SellerDay>()
  for (const drawer of closing.drawers ?? []) {
    for (const member of drawer.members ?? []) {
      if (member.id !== undefined && !days.has(member.id)) {
        days.set(member.id, { seller: member, drawer })
      }
    }
  }
  for (const { seller, total } of closing.bySeller ?? []) {
    if (seller?.id === undefined) {
      continue
    }
    const day = days.get(seller.id)
    days.set(seller.id, { seller: day?.seller ?? seller, drawer: day?.drawer, amounts: total })
  }
  return [...days.values()].sort((a, b) =>
    (b.amounts?.salesTotal ?? 0) - (a.amounts?.salesTotal ?? 0) || (a.seller.name ?? '').localeCompare(b.seller.name ?? ''))
}

/** Sales total over tickets; 0 without sales. */
export function averageTicket(amounts?: Amounts): number {
  const count = amounts?.saleCount ?? 0
  return count > 0 ? (amounts?.salesTotal ?? 0) / count : 0
}

export interface UnbalancedDrawer {
  drawer: CashDrawer
  /** Closing difference in pesos: negative is a shortage, positive a surplus. */
  difference: number
}

/**
 * Closed drawers whose difference reaches ALERT_MIN_DIFFERENCE either way, largest first. Open
 * drawers never qualify.
 */
export function unbalancedDrawers(drawers: CashDrawer[]): UnbalancedDrawer[] {
  return drawers
    .map((drawer) => ({ drawer, difference: drawer.closing?.difference ?? 0 }))
    .filter(({ difference }) => Math.abs(difference) >= ALERT_MIN_DIFFERENCE)
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
}
