import type { TFunction } from 'i18next'

import type { CashClosing } from '@/features/cash-drawer/queries'
import { memberNames } from '@/features/cash-drawer/members'
import { categoryName } from '@/features/categories/category-labels'
import type { SaleReport } from '@/features/sales/queries'
import { excelDate, type Kpi, type Section, type SheetSpec, type Tone } from '@/lib/excel'

import { closingFigures, PAYMENT_METHODS } from './closing-data'
import { bucketTitle, formatChange, formatPercent } from './format'
import { type ComparisonPoint, type FlowPoint, flowTotals, type Grouping } from './periods'
import { type CustomerSales, type ProductSales, stockValue } from './queries'
import { methodRows, salesMetrics, sellerRows } from './sales-data'

// "vs previous: +12 %" under a figure card.
function changeHint(t: TFunction, language: string, value: number | null | undefined, fallback: string) {
  return value === undefined ? fallback : t('reports.excel.changeHint', { change: formatChange(value, language) })
}

// Change against the previous period as a cell: blank when growing from zero.
function changeCell(value: number | null | undefined) {
  return value ?? undefined
}

// Figures against the previous period, sales per bucket next to the previous period's, payment
// methods, sellers and best sellers; tables come with their native charts.
export function salesReportWorkbook({ t, language, report, previous, series, grouping, period, previousPeriod, seller,
  showSellers }: {
  t: TFunction
  language: string
  report: SaleReport
  previous?: SaleReport
  series: ComparisonPoint[]
  grouping: Grouping
  period: string
  previousPeriod?: string
  seller: string
  // A seller's own report leaves the sellers table out.
  showSellers: boolean
}): SheetSpec[] {
  const metrics = salesMetrics(report, previous)
  const metric = (key: (typeof metrics)[number]['key']) => metrics.find((item) => item.key === key)!
  const compared = previous !== undefined
  const kpi = (key: (typeof metrics)[number]['key'], hint: string, tone?: Tone): Kpi => {
    const item = metric(key)
    return { label: t(`reports.sales.metrics.${key}`), value: item.current, type: item.type, tone, hint: changeHint(t, language, item.change, hint) }
  }
  const moneyMetrics = metrics.filter((item) => item.type === 'money')
  // A seller's own report has only them in it.
  const sellers: Section = {
    kind: 'pair',
    table: {
      kind: 'table',
      name: 'TVendedores',
      title: t('reports.sales.bySeller'),
      columns: [
        { key: 'name', header: t('sales.columns.seller'), width: 24 },
        { key: 'tickets', header: t('excel.sales.tickets'), type: 'int', total: 'sum' },
        { key: 'total', header: t('sales.columns.total'), type: 'money', total: 'sum', visual: 'bar' },
        { key: 'average', header: t('sales.stats.averageTicket'), type: 'money',
          formula: (cells) => `IFERROR(${cells.total}/${cells.tickets},0)` },
        { key: 'share', header: t('excel.share'), type: 'percent', total: 'sum',
          formula: (cells, ref) => `IFERROR(${cells.total}/SUM(${ref('TVendedores', 'total')}),0)` },
        ...(compared ? [{ key: 'change', header: t('reports.vsPrevious'), type: 'percent' as const }] : []),
      ],
      rows: sellerRows(report, previous).map((row) => ({
        name: row.name, tickets: row.tickets, total: row.total, average: row.average, share: row.share,
        change: changeCell(row.change),
      })),
    },
    chart: { type: 'bar', title: t('excel.sales.salesBySeller'), table: 'TVendedores', category: 'name', series: [{ column: 'total', color: '2F80C2' }], height: 14 },
  }

  return [{
    name: t('excel.sheets.summary'),
    title: t('reports.sales.title'),
    subtitle: period,
    info: [
      [t('sales.columns.seller'), seller],
      [t('reports.comparedWithLabel'), previousPeriod ?? '—'],
    ],
    sections: [
      {
        kind: 'kpis',
        title: t('reports.sales.figures'),
        items: [
          kpi('sales', t('excel.sales.completedOnly')),
          kpi('tickets', t('excel.sales.ticketsHint')),
          kpi('averageTicket', t('sales.stats.averageTicketHint')),
          kpi('vat', t('excel.sales.vatHint')),
          ...(report.profit ? [kpi('grossProfit', t('reports.excel.grossProfitHint', {
            margin: report.profit.margin === undefined || report.profit.margin === null ? '—' : formatPercent(report.profit.margin, language),
          }), 'success')] : []),
          kpi('cancelled', t('excel.sales.cancelledHint'), 'danger'),
          kpi('cancelledTickets', t('excel.sales.ticketsHint'), 'danger'),
        ],
      },
      { kind: 'note', text: t('reports.excel.salesNote') },
      ...(compared ? [{
        kind: 'table' as const,
        name: 'TComparativo',
        title: t('reports.excel.comparison'),
        columns: [
          { key: 'metric', header: t('reports.metric'), width: 26 },
          { key: 'current', header: t('reports.series.current'), type: 'money' as const },
          { key: 'previous', header: t('reports.series.previous'), type: 'money' as const },
          { key: 'difference', header: t('reports.excel.difference'), type: 'money' as const,
            formula: (cells: Record<string, string>) => `${cells.current}-${cells.previous}` },
          { key: 'change', header: t('reports.change.label'), type: 'percent' as const,
            formula: (cells: Record<string, string>) => `IF(${cells.previous}=0,"",(${cells.current}-${cells.previous})/ABS(${cells.previous}))` },
        ],
        rows: moneyMetrics.map((item) => ({
          metric: t(`reports.sales.metrics.${item.key}`),
          current: item.current,
          previous: item.previous,
          difference: item.current - (item.previous ?? 0),
          change: changeCell(item.change),
        })),
      }] : []),
      {
        kind: 'pair',
        table: {
          kind: 'table',
          name: 'TVentasPeriodo',
          title: t(`reports.sales.chart.${grouping}`),
          columns: [
            { key: 'period', header: t(`reports.grouping.${grouping}`), width: 24 },
            { key: 'current', header: t('reports.series.current'), type: 'money', total: 'sum', visual: 'bar' },
            ...(compared ? [
              { key: 'previous', header: t('reports.series.previous'), type: 'money' as const, total: 'sum' as const },
              { key: 'change', header: t('reports.change.label'), type: 'percent' as const,
                formula: (cells: Record<string, string>) => `IF(${cells.previous}=0,"",(${cells.current}-${cells.previous})/ABS(${cells.previous}))` },
            ] : []),
          ],
          rows: series.map((point) => ({
            period: bucketTitle(point, grouping, language),
            current: point.current,
            previous: point.previous,
            change: point.previous === 0 ? undefined : (point.current - point.previous) / Math.abs(point.previous),
          })),
        },
        chart: {
          type: series.length > 31 ? 'line' : 'column',
          title: t('reports.excel.salesVsPrevious'),
          table: 'TVentasPeriodo',
          category: 'period',
          series: compared ? [{ column: 'current' }, { column: 'previous', color: 'E0A030' }] : [{ column: 'current' }],
          height: Math.min(Math.max(16, series.length + 3), 24),
        },
      },
      {
        kind: 'pair',
        table: {
          kind: 'table',
          name: 'TFormasPago',
          title: t('reports.sales.byMethod'),
          columns: [
            { key: 'name', header: t('sales.columns.payment'), width: 18 },
            { key: 'tickets', header: t('excel.sales.tickets'), type: 'int', total: 'sum' },
            { key: 'total', header: t('sales.columns.total'), type: 'money', total: 'sum' },
            { key: 'share', header: t('excel.share'), type: 'percent', total: 'sum',
              formula: (cells, ref) => `IFERROR(${cells.total}/SUM(${ref('TFormasPago', 'total')}),0)` },
            ...(compared ? [{ key: 'change', header: t('reports.vsPrevious'), type: 'percent' as const }] : []),
          ],
          rows: methodRows(report, previous).map((row) => ({
            name: t(`checkout.paymentMethods.${row.method}`), tickets: row.tickets, total: row.total, share: row.share,
            change: changeCell(row.change),
          })),
        },
        chart: { type: 'doughnut', title: t('excel.sales.methodShare'), table: 'TFormasPago', category: 'name', series: [{ column: 'total' }], height: 14 },
      },
      ...(showSellers ? [sellers] : []),
      ...((report.topProducts?.length ?? 0) > 0 ? [{
        kind: 'pair' as const,
        table: {
          kind: 'table' as const,
          name: 'TMasVendidos',
          title: t('reports.sales.topProducts'),
          columns: [
            { key: 'rank', header: t('excel.rank'), type: 'int' as const, width: 7 },
            { key: 'sku', header: t('inventory.columns.sku'), type: 'code' as const },
            { key: 'name', header: t('sales.detail.product'), width: 28 },
            { key: 'quantity', header: t('excel.units'), type: 'int' as const, total: 'sum' as const },
            { key: 'subtotal', header: t('excel.sales.amountBeforeVat'), type: 'money' as const, total: 'sum' as const, visual: 'bar' as const },
          ],
          rows: (report.topProducts ?? []).map((product, index) => ({
            rank: index + 1, sku: product.sku, name: product.name, quantity: product.quantity, subtotal: product.subtotal,
          })),
        },
        chart: { type: 'bar' as const, title: t('excel.sales.topProductsChart'), table: 'TMasVendidos', category: 'name', series: [{ column: 'subtotal', color: '1C9A8A' }] },
      }] : []),
    ],
  }]
}

// One day's closing: figures, movements by payment method and by seller, and every drawer of the
// day with its count.
export function cashClosingWorkbook({ t, closing, date, seller, status }: {
  t: TFunction
  closing: CashClosing
  date: string
  seller: string
  status: string
}): SheetSpec[] {
  const drawers = closing.drawers ?? []
  const { counted, difference, closedCount } = closingFigures(closing)
  const total = closing.total

  return [{
    name: t('reports.excel.closingSheet'),
    title: t('reports.closing.title'),
    subtitle: date,
    info: [
      [t('sales.columns.seller'), seller],
      [t('reports.closing.status'), status],
    ],
    sections: [
      {
        kind: 'kpis',
        title: t('reports.closing.figures'),
        items: [
          { label: t('reports.closing.metrics.net'), value: total?.net, type: 'money', hint: t('reports.closing.metrics.netHint') },
          { label: t('reports.closing.metrics.sales'), value: total?.salesTotal, type: 'money',
            hint: t('reports.closing.salesCount', { count: total?.saleCount ?? 0 }) },
          { label: t('reports.closing.metrics.cancellations'), value: total?.cancellationsTotal, type: 'money', tone: 'danger',
            hint: t('reports.closing.cancellationsCount', { count: total?.cancellationCount ?? 0 }) },
          { label: t('reports.closing.metrics.floats'), value: closing.openingFloat, type: 'money', tone: 'muted',
            hint: t('reports.closing.metrics.floatsHint') },
          { label: t('reports.closing.metrics.expected'), value: closing.expectedCash, type: 'money',
            hint: t('reports.closing.metrics.expectedHint') },
          { label: t('reports.closing.metrics.counted'), value: counted, type: 'money',
            hint: t('reports.closing.closedDrawers', { count: closedCount, total: drawers.length }) },
          { label: t('reports.closing.metrics.difference'), value: difference, type: 'money',
            tone: difference < 0 ? 'danger' : difference > 0 ? 'warning' : 'success', hint: t('reports.closing.metrics.differenceHint') },
        ],
      },
      {
        kind: 'pair',
        table: {
          kind: 'table',
          name: 'TCorteFormas',
          title: t('reports.closing.byMethod'),
          columns: [
            { key: 'method', header: t('sales.columns.payment'), width: 18 },
            { key: 'sales', header: t('print.closing.sales'), type: 'int', total: 'sum' },
            { key: 'salesTotal', header: t('reports.closing.salesAmount'), type: 'money', total: 'sum' },
            { key: 'cancellations', header: t('print.closing.cancellations'), type: 'int', total: 'sum', color: 'danger' },
            { key: 'cancellationsTotal', header: t('reports.closing.cancellationsAmount'), type: 'money', total: 'sum', color: 'danger' },
            { key: 'net', header: t('print.closing.net'), type: 'money', total: 'sum',
              formula: (cells) => `${cells.salesTotal}-${cells.cancellationsTotal}` },
          ],
          rows: PAYMENT_METHODS.map((method) => {
            const amounts = closing.byPaymentMethod?.[method]
            return {
              method: t(`checkout.paymentMethods.${method}`),
              sales: amounts?.saleCount ?? 0,
              salesTotal: amounts?.salesTotal ?? 0,
              cancellations: amounts?.cancellationCount ?? 0,
              cancellationsTotal: amounts?.cancellationsTotal ?? 0,
              net: amounts?.net ?? 0,
            }
          }),
        },
        chart: { type: 'column', title: t('reports.closing.netByMethod'), table: 'TCorteFormas', category: 'method', series: [{ column: 'net' }], height: 12 },
      },
      {
        kind: 'table',
        name: 'TCorteVendedores',
        title: t('reports.closing.bySeller'),
        columns: [
          { key: 'seller', header: t('sales.columns.seller'), width: 26 },
          { key: 'sales', header: t('print.closing.sales'), type: 'int', total: 'sum' },
          { key: 'salesTotal', header: t('reports.closing.salesAmount'), type: 'money', total: 'sum' },
          { key: 'cancellationsTotal', header: t('reports.closing.cancellationsAmount'), type: 'money', total: 'sum', color: 'danger' },
          { key: 'cash', header: t('reports.closing.cashNet'), type: 'money', total: 'sum' },
          { key: 'net', header: t('print.closing.net'), type: 'money', total: 'sum', visual: 'bar' },
        ],
        rows: (closing.bySeller ?? []).map((row) => ({
          seller: row.seller?.name,
          sales: row.total?.saleCount,
          salesTotal: row.total?.salesTotal,
          cancellationsTotal: row.total?.cancellationsTotal,
          cash: row.cash?.net,
          net: row.total?.net,
        })),
      },
      {
        kind: 'table',
        name: 'TCajas',
        title: t('reports.closing.drawers'),
        columns: [
          { key: 'responsible', header: t('drawer.responsible'), width: 22 },
          { key: 'members', header: t('drawer.members'), width: 28 },
          { key: 'openedAt', header: t('reports.closing.openedAt'), type: 'datetime' },
          { key: 'closedAt', header: t('reports.closing.closedAt'), type: 'datetime' },
          { key: 'float', header: t('drawer.openingFloat'), type: 'money', total: 'sum' },
          { key: 'expected', header: t('drawer.expectedCash'), type: 'money', total: 'sum' },
          { key: 'counted', header: t('drawer.countedCash'), type: 'money', total: 'sum' },
          { key: 'difference', header: t('drawer.difference'), type: 'money', total: 'sum',
            formula: (cells, _ref, row) => row.counted === undefined ? undefined : `${cells.counted}-${cells.expected}` },
          { key: 'note', header: t('reports.closing.note'), width: 30 },
        ],
        highlights: [
          { tone: 'danger', when: (cells) => `AND(ISNUMBER(${cells.difference}),${cells.difference}<0)` },
          { tone: 'warning', when: (cells) => `AND(ISNUMBER(${cells.difference}),${cells.difference}>0)` },
        ],
        rows: drawers.map((drawer) => ({
          responsible: drawer.responsible?.name,
          members: memberNames(drawer),
          openedAt: drawer.openedAt ? excelDate(drawer.openedAt) : undefined,
          closedAt: drawer.closing?.closedAt ? excelDate(drawer.closing.closedAt) : undefined,
          float: drawer.openingFloat,
          expected: drawer.closing?.expectedCash,
          counted: drawer.closing?.countedCash,
          difference: drawer.closing?.difference,
          note: drawer.closing?.note,
        })),
      },
    ],
  }]
}

// Money in and out per bucket with formulas for the figures, so editing a row updates the totals.
export function cashFlowWorkbook({ t, language, series, grouping, period }: {
  t: TFunction
  language: string
  series: FlowPoint[]
  grouping: Grouping
  period: string
}): SheetSpec[] {
  const { sales, purchases, net } = flowTotals(series)

  return [{
    name: t('reports.excel.flowSheet'),
    title: t('reports.flow.title'),
    subtitle: period,
    info: [[t('reports.grouping.label'), t(`reports.grouping.${grouping}`)]],
    sections: [
      {
        kind: 'kpis',
        title: t('reports.flow.figures'),
        items: [
          { label: t('reports.flow.metrics.sales'), value: sales, type: 'money', hint: t('reports.flow.metrics.salesHint'),
            formula: (ref) => `SUM(${ref('TFlujo', 'sales')})` },
          { label: t('reports.flow.metrics.purchases'), value: purchases, type: 'money', tone: 'warning',
            hint: t('reports.flow.metrics.purchasesHint'), formula: (ref) => `SUM(${ref('TFlujo', 'purchases')})` },
          { label: t('reports.flow.metrics.net'), value: net, type: 'money', tone: net < 0 ? 'danger' : 'success',
            hint: t('reports.flow.metrics.netHint'), formula: (ref) => `SUM(${ref('TFlujo', 'sales')})-SUM(${ref('TFlujo', 'purchases')})` },
          { label: t('reports.flow.metrics.ratio'), value: sales > 0 ? purchases / sales : 0, type: 'percent', tone: 'muted',
            hint: t('reports.flow.metrics.ratioHint'),
            formula: (ref) => `IFERROR(SUM(${ref('TFlujo', 'purchases')})/SUM(${ref('TFlujo', 'sales')}),0)` },
        ],
      },
      { kind: 'note', text: t('reports.flow.note') },
      {
        kind: 'pair',
        table: {
          kind: 'table',
          name: 'TFlujo',
          title: t(`reports.flow.by.${grouping}`),
          columns: [
            { key: 'period', header: t(`reports.grouping.${grouping}`), width: 24 },
            { key: 'sales', header: t('reports.series.sales'), type: 'money', total: 'sum' },
            { key: 'purchases', header: t('reports.series.purchases'), type: 'money', total: 'sum' },
            { key: 'net', header: t('reports.flow.net'), type: 'money', total: 'sum', visual: 'bar',
              formula: (cells) => `${cells.sales}-${cells.purchases}` },
            { key: 'cumulative', header: t('reports.series.cumulative'), type: 'money' },
          ],
          highlights: [{ tone: 'danger', when: (cells) => `${cells.net}<0` }],
          rows: series.map((point) => ({
            period: bucketTitle(point, grouping, language),
            sales: point.sales,
            purchases: point.purchases,
            net: point.net,
            cumulative: point.cumulative,
          })),
        },
        chart: {
          type: 'column', title: t('reports.flow.chart'), table: 'TFlujo', category: 'period',
          series: [{ column: 'sales' }, { column: 'purchases', color: 'E0A030' }],
          height: Math.min(Math.max(16, series.length + 3), 24),
        },
      },
    ],
  }]
}

// Every product sold in the period with cost, gross profit and margin as formulas, or the products in
// stock that didn't sell with the value waiting on the shelf.
export function productSalesWorkbook({ t, rows, unsold, period, info, truncated }: {
  t: TFunction
  rows: ProductSales[]
  unsold: boolean
  period: string
  info: [string, string][]
  truncated: boolean
}): SheetSpec[] {
  const note = truncated ? [{ kind: 'note' as const, text: t('excel.truncated', { count: rows.length }) }] : []
  const product = (row: ProductSales) => ({
    sku: row.sku, name: row.name, category: categoryName(row.category?.name, t),
    status: t(row.active ? 'reports.products.active' : 'reports.products.inactive'),
  })
  const productColumns = [
    { key: 'sku', header: t('inventory.columns.sku'), type: 'code' as const },
    { key: 'name', header: t('sales.detail.product'), width: 30 },
    { key: 'category', header: t('products.columns.category'), width: 18 },
  ]

  if (unsold) {
    return [{
      name: t('reports.excel.unsoldSheet'),
      title: t('reports.products.unsoldTitle'),
      subtitle: period,
      info,
      landscape: true,
      sections: [...note, { kind: 'note', text: t('reports.products.unsoldHint') }, {
        kind: 'table',
        name: 'TSinVenta',
        main: true,
        columns: [
          ...productColumns,
          { key: 'stock', header: t('reports.products.stock'), type: 'int', total: 'sum' },
          { key: 'averageCost', header: t('reports.products.averageCost'), type: 'money' },
          { key: 'value', header: t('reports.products.stockValue'), type: 'money', total: 'sum', visual: 'bar',
            formula: (cells, _ref, row) => row.averageCost === undefined ? undefined : `${cells.stock}*${cells.averageCost}` },
          { key: 'lastSale', header: t('reports.products.lastSale'), type: 'date' },
        ],
        rows: rows.map((row) => ({
          ...product(row),
          stock: row.stock,
          averageCost: row.averageCost ?? undefined,
          value: stockValue(row) ?? undefined,
          lastSale: row.lastSaleDate ? excelDate(row.lastSaleDate) : undefined,
        })),
      }],
    }]
  }

  return [{
    name: t('reports.excel.productsSheet'),
    title: t('reports.products.soldTitle'),
    subtitle: period,
    info,
    landscape: true,
    sections: [...note, { kind: 'note', text: t('reports.products.noCostHint') }, {
      kind: 'table',
      name: 'TVentasProducto',
      main: true,
      columns: [
        ...productColumns,
        { key: 'status', header: t('sales.columns.status'), width: 12 },
        { key: 'quantity', header: t('excel.units'), type: 'int', total: 'sum' },
        { key: 'subtotal', header: t('excel.sales.amountBeforeVat'), type: 'money', total: 'sum', visual: 'bar' },
        { key: 'cost', header: t('reports.products.cost'), type: 'money', total: 'sum' },
        { key: 'profit', header: t('reports.products.profit'), type: 'money', total: 'sum',
          formula: (cells, _ref, row) => row.cost === undefined ? undefined : `${cells.subtotal}-${cells.cost}` },
        { key: 'margin', header: t('reports.products.margin'), type: 'percent', visual: 'scale',
          formula: (cells, _ref, row) => row.cost === undefined ? undefined : `IFERROR(${cells.profit}/${cells.subtotal},"")` },
        { key: 'stock', header: t('reports.products.stock'), type: 'int' },
      ],
      highlights: [{ tone: 'danger', when: (cells) => `AND(ISNUMBER(${cells.profit}),${cells.profit}<0)` }],
      rows: rows.map((row) => {
        const known = row.cost !== undefined && row.cost !== null
        return {
          ...product(row),
          quantity: row.quantity,
          subtotal: row.subtotal,
          cost: known ? row.cost : undefined,
          profit: known ? row.grossProfit ?? undefined : undefined,
          margin: known && (row.subtotal ?? 0) > 0 ? (row.grossProfit ?? 0) / row.subtotal! : undefined,
          stock: row.stock,
        }
      }),
    }],
  }]
}

// Registered customers by what they bought in the period, best first.
export function customerSalesWorkbook({ t, rows, period, truncated }: {
  t: TFunction
  rows: CustomerSales[]
  period: string
  truncated: boolean
}): SheetSpec[] {
  return [{
    name: t('reports.excel.customersSheet'),
    title: t('reports.customers.title'),
    subtitle: period,
    sections: [
      ...(truncated ? [{ kind: 'note' as const, text: t('excel.truncated', { count: rows.length }) }] : []),
      { kind: 'note', text: t('reports.customers.hint') },
      {
        kind: 'table',
        name: 'TClientes',
        main: true,
        columns: [
          { key: 'rank', header: t('excel.rank'), type: 'int', width: 7 },
          { key: 'name', header: t('sales.columns.customer'), width: 32 },
          { key: 'taxId', header: t('reports.customers.taxId'), type: 'code' },
          { key: 'tickets', header: t('excel.sales.tickets'), type: 'int', total: 'sum' },
          { key: 'total', header: t('sales.columns.total'), type: 'money', total: 'sum', visual: 'bar' },
          { key: 'average', header: t('sales.stats.averageTicket'), type: 'money',
            formula: (cells) => `IFERROR(${cells.total}/${cells.tickets},0)` },
          { key: 'share', header: t('excel.share'), type: 'percent', total: 'sum',
            formula: (cells, ref) => `IFERROR(${cells.total}/SUM(${ref('TClientes', 'total')}),0)` },
          { key: 'lastSale', header: t('reports.customers.lastPurchase'), type: 'datetime' },
        ],
        rows: rows.map((row, index) => {
          const sum = rows.reduce((total, other) => total + (other.total ?? 0), 0)
          return {
            rank: index + 1,
            name: row.name,
            taxId: row.taxId,
            tickets: row.saleCount,
            total: row.total,
            average: row.averageTicket,
            share: sum > 0 ? (row.total ?? 0) / sum : 0,
            lastSale: row.lastSaleDate ? excelDate(row.lastSaleDate) : undefined,
          }
        }),
      },
    ],
  }]
}
