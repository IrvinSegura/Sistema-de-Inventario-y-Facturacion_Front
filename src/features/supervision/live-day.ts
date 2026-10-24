import type { Schemas } from '@/api/client'
import type { CashClosing, CashDrawer } from '@/features/cash-drawer/queries'
import type { SaleSummary } from '@/features/sales/queries'
import { STORE_TIME_ZONE, toDay } from '@/lib/days'

type Ref = Schemas['Ref']
type Amounts = Schemas['Amounts']

// The API's default for app.cash-drawer.unbalanced-threshold, for an API that doesn't send it yet;
// remove it once every deployed API does.
export const DEFAULT_UNBALANCED_THRESHOLD = 50

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
 * The closing's drawers whose difference reaches the store's unbalanced threshold either way,
 * largest first. Open drawers never qualify.
 */
export function unbalancedDrawers(closing: CashClosing): UnbalancedDrawer[] {
  const threshold = closing.unbalancedThreshold ?? DEFAULT_UNBALANCED_THRESHOLD
  return (closing.drawers ?? [])
    .map((drawer) => ({ drawer, difference: drawer.closing?.difference ?? 0 }))
    .filter(({ difference }) => Math.abs(difference) >= threshold)
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
}

/** What the live page's alerts show; the sidebar counts the same. */
export interface LiveAlerts {
  /** Drawers of earlier days still open. */
  stale: CashDrawer[]
  unbalanced: UnbalancedDrawer[]
  lowStockCount: number
  /** Manual stock adjustments recorded today across the store. */
  adjustmentCount: number
  /** Purchases cancelled today, whenever they were recorded. */
  purchaseCancellationCount: number
}

/**
 * One per alert line: the stale drawers, low stock, adjustments and purchase cancellations count once
 * each, each unbalanced drawer on its own.
 */
export function alertCount({ stale, unbalanced, lowStockCount, adjustmentCount, purchaseCancellationCount }: LiveAlerts): number {
  return (stale.length > 0 ? 1 : 0) + unbalanced.length + (lowStockCount > 0 ? 1 : 0) + (adjustmentCount > 0 ? 1 : 0)
    + (purchaseCancellationCount > 0 ? 1 : 0)
}

/** Today's sales so far as a share of a whole earlier day's (1 = as much); null when that day sold nothing. */
export function salesShare(soFar: number, earlierDay: number): number | null {
  return earlierDay > 0 ? soFar / earlierDay : null
}

/**
 * The store day a sale cancelled on `day` was sold on, when earlier than `day` (its refund still
 * counts on `day`); undefined when sold that same day.
 */
export function earlierSaleDay(sale: SaleSummary, day: string, timeZone = STORE_TIME_ZONE): string | undefined {
  const soldOn = sale.saleDate === undefined ? undefined : toDay(sale.saleDate, timeZone)
  return soldOn !== undefined && soldOn < day ? soldOn : undefined
}
