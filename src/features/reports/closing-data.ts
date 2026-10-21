import type { CashClosing } from '@/features/cash-drawer/queries'
import { fromCents, toCents } from '@/lib/money'

export const PAYMENT_METHODS = ['CASH', 'CARD', 'TRANSFER'] as const

export interface ClosingFigures {
  sales: number
  cancellations: number
  net: number
  floats: number
  /** Net cash of the day's sales and refunds. */
  cashNet: number
  /** Floats plus the net cash: what every drawer of the day should hold together. */
  expected: number
  drawerCount: number
  closedCount: number
  /**
   * Of the closed drawers only, as recorded when each one was closed; counted and difference cover
   * the same drawers.
   */
  closedExpected: number
  counted: number
  difference: number
}

/** A day's totals, and the counts of the drawers already closed. */
export function closingFigures(closing: CashClosing): ClosingFigures {
  const drawers = closing.drawers ?? []
  const closed = drawers.map((drawer) => drawer.closing).filter((figures) => figures !== undefined)
  const sum = (values: (number | undefined)[]) => fromCents(values.reduce<number>((total, value) => total + toCents(value ?? 0), 0))
  return {
    sales: closing.total?.salesTotal ?? 0,
    cancellations: closing.total?.cancellationsTotal ?? 0,
    net: closing.total?.net ?? 0,
    floats: closing.openingFloat ?? 0,
    cashNet: closing.byPaymentMethod?.CASH?.net ?? 0,
    expected: closing.expectedCash ?? 0,
    drawerCount: drawers.length,
    closedCount: closed.length,
    closedExpected: sum(closed.map((figures) => figures.expectedCash)),
    counted: sum(closed.map((figures) => figures.countedCash)),
    difference: sum(closed.map((figures) => figures.difference)),
  }
}
