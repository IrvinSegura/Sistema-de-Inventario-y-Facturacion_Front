import type { SaleReport } from '@/features/sales/queries'

import { change } from './periods'

export type MetricKey = 'sales' | 'tickets' | 'averageTicket' | 'subtotal' | 'vat' | 'grossProfit' | 'cancelled'
  | 'cancelledTickets'

export interface Metric {
  key: MetricKey
  type: 'money' | 'int'
  current: number
  /** Undefined when there is no previous period to compare with. */
  previous?: number
  /** As a fraction from change(): null when growing from zero, undefined without a previous period. */
  change?: number | null
  /** Less is better (cancellations). */
  inverse?: boolean
}

/**
 * The period's figures next to the previous period's, in the order the report shows them. Gross
 * profit only comes for managers (the API leaves costs out for sellers).
 */
export function salesMetrics(report: SaleReport, previous?: SaleReport): Metric[] {
  const metric = (key: MetricKey, type: Metric['type'], read: (report: SaleReport) => number | undefined,
    inverse?: boolean): Metric => {
    const current = read(report) ?? 0
    const before = previous && (read(previous) ?? 0)
    return { key, type, current, previous: before, change: before === undefined ? undefined : change(current, before), inverse }
  }
  return [
    metric('sales', 'money', (r) => r.completed?.total),
    metric('tickets', 'int', (r) => r.completed?.saleCount),
    metric('averageTicket', 'money', (r) => r.averageTicket),
    metric('subtotal', 'money', (r) => r.completed?.subtotal),
    metric('vat', 'money', (r) => r.completed?.tax),
    ...(report.profit ? [metric('grossProfit', 'money', (r) => r.profit?.grossProfit)] : []),
    metric('cancelled', 'money', (r) => r.cancelled?.total, true),
    metric('cancelledTickets', 'int', (r) => r.cancelled?.saleCount, true),
  ]
}

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER'

export interface MethodRow {
  method: PaymentMethod
  tickets: number
  total: number
  /** Of the period's completed sales. */
  share: number
  change?: number | null
}

/** Every payment method with sales in either period. */
export function methodRows(report: SaleReport, previous?: SaleReport): MethodRow[] {
  const total = report.completed?.total ?? 0
  const find = (from: SaleReport | undefined, method: PaymentMethod) =>
    from?.byPaymentMethod?.find((row) => row.paymentMethod === method)
  const methods: PaymentMethod[] = ['CASH', 'CARD', 'TRANSFER']
  return methods
    .filter((method) => (find(report, method)?.saleCount ?? 0) > 0 || (find(previous, method)?.saleCount ?? 0) > 0)
    .map((method) => {
      const now = find(report, method)
      const amount = now?.total ?? 0
      return {
        method,
        tickets: now?.saleCount ?? 0,
        total: amount,
        share: total > 0 ? amount / total : 0,
        change: previous ? change(amount, find(previous, method)?.total ?? 0) : undefined,
      }
    })
}

export interface SellerRow {
  id: number
  name: string
  tickets: number
  total: number
  average: number
  share: number
  change?: number | null
}

/** Sellers of the period, best first, against what each one sold in the previous period. */
export function sellerRows(report: SaleReport, previous?: SaleReport): SellerRow[] {
  const total = report.completed?.total ?? 0
  return (report.bySeller ?? []).map((seller) => {
    const before = previous?.bySeller?.find((row) => row.sellerId === seller.sellerId)
    const amount = seller.total ?? 0
    const tickets = seller.saleCount ?? 0
    return {
      id: seller.sellerId!,
      name: seller.name ?? '',
      tickets,
      total: amount,
      average: tickets > 0 ? amount / tickets : 0,
      share: total > 0 ? amount / total : 0,
      change: previous ? change(amount, before?.total ?? 0) : undefined,
    }
  }).sort((a, b) => b.total - a.total)
}
