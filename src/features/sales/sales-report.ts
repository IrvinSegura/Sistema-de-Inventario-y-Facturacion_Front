import type { TFunction } from 'i18next'

import { excelDate, excelDay, type Kpi, type Row, type SheetSpec } from '@/lib/excel'
import { fromCents, toCents } from '@/lib/money'

import type { SaleReport, SaleSummary } from './queries'

function quote(text: string) {
  return `"${text.replace(/"/g, '""')}"`
}

function local(day: Date) {
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
}

// Dashboard (figures, sales by day, payment method, seller and best sellers, each with its chart) and
// every ticket. With live figures the cards are formulas over the tickets sheet; otherwise (other
// filters or a cut list) they come from the server's report, which covers the whole period.
export function salesWorkbook({ t, sales, truncated, report, live, period, info }: {
  t: TFunction
  sales: SaleSummary[]
  truncated: boolean
  report?: SaleReport
  // The tickets are exactly the report's sales (no customer, status or ticket filter, nothing cut).
  live: boolean
  period: string
  info: [string, string][]
}): SheetSpec[] {
  const completed = t('sales.status.COMPLETED')
  const cancelledLabel = t('sales.status.CANCELLED')
  const done = sales.filter((sale) => sale.status === 'COMPLETED')
  const cents = (list: SaleSummary[]) => list.reduce((sum, sale) => sum + toCents(sale.total ?? 0), 0)
  const cancelled = sales.filter((sale) => sale.status === 'CANCELLED')

  const total = report?.completed?.total ?? fromCents(cents(done))
  const count = report?.completed?.saleCount ?? done.length
  const cancelledTotal = report?.cancelled?.total ?? fromCents(cents(cancelled))
  const cancelledCount = report?.cancelled?.saleCount ?? cancelled.length
  const allCount = count + cancelledCount

  const kpi = (item: Kpi, formula?: (ref: Parameters<NonNullable<Kpi['formula']>>[0]) => string): Kpi =>
    live && formula ? { ...item, formula } : item

  const kpis: Kpi[] = [
    kpi({ label: t('sales.stats.sales'), value: total, type: 'money', hint: t('excel.sales.completedOnly') },
      (ref) => `SUMIF(${ref('TVentas', 'status')},${quote(completed)},${ref('TVentas', 'total')})`),
    kpi({ label: t('excel.sales.completedCount'), value: count, type: 'int', hint: t('excel.sales.ticketsHint') },
      (ref) => `COUNTIF(${ref('TVentas', 'status')},${quote(completed)})`),
    kpi({ label: t('sales.stats.averageTicket'), value: report?.averageTicket ?? (count ? total / count : 0), type: 'money',
      hint: t('sales.stats.averageTicketHint') },
    (ref) => `IFERROR(AVERAGEIF(${ref('TVentas', 'status')},${quote(completed)},${ref('TVentas', 'total')}),0)`),
    ...(report ? [
      { label: t('sales.stats.vat'), value: report.completed?.tax, type: 'money' as const, hint: t('excel.sales.vatHint') },
    ] : []),
    kpi({ label: t('sales.stats.cancelled'), value: cancelledTotal, type: 'money', tone: 'danger', hint: t('excel.sales.cancelledHint') },
      (ref) => `SUMIF(${ref('TVentas', 'status')},${quote(cancelledLabel)},${ref('TVentas', 'total')})`),
    kpi({ label: t('excel.sales.cancelledCount'), value: cancelledCount, type: 'int', tone: 'danger', hint: t('excel.sales.ticketsHint') },
      (ref) => `COUNTIF(${ref('TVentas', 'status')},${quote(cancelledLabel)})`),
    kpi({ label: t('excel.sales.cancelRate'), value: allCount ? cancelledCount / allCount : 0, type: 'percent', tone: 'warning',
      hint: t('excel.sales.cancelRateHint') },
    (ref) => `IFERROR(COUNTIF(${ref('TVentas', 'status')},${quote(cancelledLabel)})/COUNTA(${ref('TVentas', 'status')}),0)`),
    ...(report ? [
      { label: t('excel.sales.subtotal'), value: report.completed?.subtotal, type: 'money' as const, tone: 'muted' as const,
        hint: t('excel.sales.subtotalHint') },
    ] : []),
  ]

  // Breakdowns from the report, or from the completed tickets when there is none.
  const byDay: Row[] = report?.byDay
    ? report.byDay.map((day) => ({ date: excelDay(day.date!), tickets: day.saleCount, total: day.total }))
    : [...done.reduce((days, sale) => {
      const day = local(new Date(sale.saleDate!))
      const entry = days.get(day) ?? { tickets: 0, cents: 0 }
      entry.tickets++
      entry.cents += toCents(sale.total ?? 0)
      return days.set(day, entry)
    }, new Map<string, { tickets: number; cents: number }>())]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, entry]) => ({ date: excelDay(day), tickets: entry.tickets, total: fromCents(entry.cents) }))

  const group = (key: (sale: SaleSummary) => string) => [...done.reduce((groups, sale) => {
    const entry = groups.get(key(sale)) ?? { tickets: 0, cents: 0 }
    entry.tickets++
    entry.cents += toCents(sale.total ?? 0)
    return groups.set(key(sale), entry)
  }, new Map<string, { tickets: number; cents: number }>())]
    .map(([name, entry]) => ({ name, tickets: entry.tickets, total: fromCents(entry.cents) }))
    .sort((a, b) => b.total - a.total)

  const methods: Row[] = (report?.byPaymentMethod
    ? report.byPaymentMethod.map((method) => ({
      name: t(`checkout.paymentMethods.${method.paymentMethod!}`), tickets: method.saleCount, total: method.total,
    }))
    : group((sale) => t(`checkout.paymentMethods.${sale.paymentMethod!}`)))
    .map((row) => ({ ...row, share: total > 0 ? (row.total ?? 0) / total : 0 }))
  const sellers: Row[] = (report?.bySeller
    ? report.bySeller.map((seller) => ({ name: seller.name, tickets: seller.saleCount, total: seller.total }))
    : group((sale) => sale.seller?.name ?? ''))
    .map((row) => ({
      ...row,
      average: row.tickets ? (row.total ?? 0) / row.tickets : 0,
      share: total > 0 ? (row.total ?? 0) / total : 0,
    }))
  const products: Row[] = (report?.topProducts ?? []).map((product, index) => ({
    rank: index + 1, sku: product.sku, name: product.name, quantity: product.quantity, subtotal: product.subtotal,
  }))

  const share = (table: string) => (cells: Record<string, string>, ref: (table: string, column: string) => string) =>
    `IFERROR(${cells.total}/SUM(${ref(table, 'total')}),0)`

  return [
    {
      name: t('excel.sheets.summary'),
      title: t('excel.sales.title'),
      subtitle: period,
      info,
      sections: [
        { kind: 'kpis', title: t('excel.sales.figures'), items: kpis },
        { kind: 'note', text: live ? t('excel.sales.liveNote') : t('excel.sales.summaryNote') },
        ...(byDay.length > 0 ? [{
          kind: 'pair' as const,
          table: {
            kind: 'table' as const,
            name: 'TVentasDia',
            title: t('excel.sales.byDay'),
            columns: [
              { key: 'date', header: t('sales.columns.date'), type: 'date' as const },
              { key: 'tickets', header: t('excel.sales.tickets'), type: 'int' as const, total: 'sum' as const },
              { key: 'total', header: t('sales.columns.total'), type: 'money' as const, total: 'sum' as const, visual: 'bar' as const },
            ],
            rows: byDay,
          },
          chart: {
            type: byDay.length > 31 ? 'line' as const : 'column' as const, title: t('excel.sales.salesByDay'),
            table: 'TVentasDia', category: 'date', series: [{ column: 'total' }],
            height: Math.min(Math.max(16, byDay.length + 3), 24),
          },
        }] : []),
        {
          kind: 'pair',
          table: {
            kind: 'table',
            name: 'TFormasPago',
            title: t('excel.sales.byMethod'),
            columns: [
              { key: 'name', header: t('sales.columns.payment'), width: 18 },
              { key: 'tickets', header: t('excel.sales.tickets'), type: 'int', total: 'sum' },
              { key: 'total', header: t('sales.columns.total'), type: 'money', total: 'sum' },
              { key: 'share', header: t('excel.share'), type: 'percent', total: 'sum', formula: share('TFormasPago') },
            ],
            rows: methods,
          },
          chart: { type: 'doughnut', title: t('excel.sales.methodShare'), table: 'TFormasPago', category: 'name', series: [{ column: 'total' }], height: 14 },
        },
        {
          kind: 'pair',
          table: {
            kind: 'table',
            name: 'TVendedores',
            title: t('excel.sales.bySeller'),
            columns: [
              { key: 'name', header: t('sales.columns.seller'), width: 24 },
              { key: 'tickets', header: t('excel.sales.tickets'), type: 'int', total: 'sum' },
              { key: 'total', header: t('sales.columns.total'), type: 'money', total: 'sum', visual: 'bar' },
              { key: 'average', header: t('sales.stats.averageTicket'), type: 'money',
                formula: (cells) => `IFERROR(${cells.total}/${cells.tickets},0)` },
              { key: 'share', header: t('excel.share'), type: 'percent', total: 'sum', formula: share('TVendedores') },
            ],
            rows: sellers,
          },
          chart: { type: 'bar', title: t('excel.sales.salesBySeller'), table: 'TVendedores', category: 'name', series: [{ column: 'total', color: '2F80C2' }], height: 14 },
        },
        ...(products.length > 0 ? [{
          kind: 'pair' as const,
          table: {
            kind: 'table' as const,
            name: 'TMasVendidos',
            title: t('excel.sales.topProducts'),
            columns: [
              { key: 'rank', header: t('excel.rank'), type: 'int' as const, width: 7 },
              { key: 'sku', header: t('inventory.columns.sku'), type: 'code' as const },
              { key: 'name', header: t('sales.detail.product'), width: 28 },
              { key: 'quantity', header: t('excel.units'), type: 'int' as const, total: 'sum' as const },
              { key: 'subtotal', header: t('excel.sales.amountBeforeVat'), type: 'money' as const, total: 'sum' as const, visual: 'bar' as const },
            ],
            rows: products,
          },
          chart: { type: 'bar' as const, title: t('excel.sales.topProductsChart'), table: 'TMasVendidos', category: 'name', series: [{ column: 'subtotal', color: '1C9A8A' }] },
        }] : []),
        { kind: 'links', label: t('excel.goTo'), sheets: [t('excel.sheets.sales')] },
      ],
    },
    {
      name: t('excel.sheets.sales'),
      title: t('excel.sales.ticketsTitle'),
      subtitle: period,
      info: [...info, [t('excel.sales.ticketCount'), t('excel.sales.ticketCountValue', { count: sales.length, cancelled: cancelled.length })]],
      landscape: true,
      sections: [
        ...(truncated ? [{ kind: 'note' as const, text: t('sales.exportTruncated', { count: sales.length }) }] : []),
        {
          kind: 'table',
          name: 'TVentas',
          main: true,
          columns: [
            { key: 'number', header: t('sales.columns.number'), type: 'int', width: 10 },
            { key: 'date', header: t('sales.columns.date'), type: 'datetime' },
            { key: 'customer', header: t('sales.columns.customer'), width: 28 },
            { key: 'seller', header: t('sales.columns.seller'), width: 22 },
            { key: 'payment', header: t('sales.columns.payment'), width: 15 },
            { key: 'status', header: t('sales.columns.status'), width: 14 },
            {
              key: 'total', header: t('sales.columns.total'), type: 'money', visual: 'bar',
              // Cancelled tickets are listed but left out of the total.
              total: {
                formula: (ref) => `SUMIF(${ref('TVentas', 'status')},${quote(completed)},${ref('TVentas', 'total')})`,
                result: fromCents(cents(done)),
              },
            },
          ],
          totalsLabel: t('excel.sales.totalCompleted'),
          highlights: [{ tone: 'danger', when: (cells) => `${cells.status}=${quote(cancelledLabel)}` }],
          rows: sales.map((sale) => ({
            number: sale.saleNumber,
            date: excelDate(sale.saleDate!),
            customer: sale.customer?.name,
            seller: sale.seller?.name,
            payment: t(`checkout.paymentMethods.${sale.paymentMethod!}`),
            status: t(`sales.status.${sale.status!}`),
            total: sale.total,
          })),
        },
      ],
    },
  ]
}
