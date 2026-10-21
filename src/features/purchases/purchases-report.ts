import type { TFunction } from 'i18next'

import { toDay } from '@/lib/days'
import { excelDate, excelDay, excelStoreDay, type Kpi, type Row, type SheetSpec } from '@/lib/excel'
import { fromCents, toCents } from '@/lib/money'

import type { Purchase, PurchaseSummary } from './queries'

/**
 * Dashboard (figures, suppliers, purchases by day and the products bought, each with its chart), the
 * purchases and, when their lines were loaded, every line. Figures, supplier totals, products and
 * line subtotals are formulas over the data sheets.
 */
export function purchasesWorkbook({ t, purchases, truncated, details, period, info }: {
  t: TFunction
  purchases: PurchaseSummary[]
  truncated: boolean
  /** The same purchases with their lines, in the same order; null when there were too many to load. */
  details: Purchase[] | null
  period: string
  info: [string, string][]
}): SheetSpec[] {
  const totalCents = purchases.reduce((sum, purchase) => sum + toCents(purchase.total ?? 0), 0)
  const total = fromCents(totalCents)
  const purchasesSheet = t('excel.sheets.purchases')

  const purchaseRows: Row[] = purchases.map((purchase, index) => ({
    id: purchase.id,
    date: excelDate(purchase.purchaseDate!),
    supplier: purchase.supplier?.name,
    recordedBy: purchase.recordedBy?.name,
    lines: details?.[index]?.items?.length,
    units: details?.[index]?.items?.reduce((sum, item) => sum + (item.quantity ?? 0), 0),
    total: purchase.total,
  }))
  const lineRows: Row[] = (details ?? []).flatMap((purchase) => (purchase.items ?? []).map((item) => ({
    id: purchase.id,
    date: excelDate(purchase.purchaseDate!),
    supplier: purchase.supplier?.name,
    sku: item.sku,
    name: item.name,
    quantity: item.quantity,
    unitCost: item.unitCost,
    subtotal: item.subtotal,
  })))
  const units = lineRows.reduce((sum, row) => sum + ((row.quantity as number) ?? 0), 0)

  // By name, not id: the TProveedores formulas match TCompras on the supplier name column.
  const suppliers: Row[] = [...purchases.reduce((groups, purchase) => {
    const name = purchase.supplier?.name ?? ''
    const entry = groups.get(name) ?? { count: 0, cents: 0, last: purchase.purchaseDate! }
    entry.count++
    entry.cents += toCents(purchase.total ?? 0)
    if (purchase.purchaseDate! > entry.last) {
      entry.last = purchase.purchaseDate!
    }
    return groups.set(name, entry)
  }, new Map<string, { count: number; cents: number; last: string }>())]
    .map(([name, entry]) => ({
      name, purchases: entry.count, total: fromCents(entry.cents), share: totalCents ? entry.cents / totalCents : 0,
      last: excelStoreDay(entry.last),
    }))
    .sort((a, b) => (b.total as number) - (a.total as number))

  const days: Row[] = [...purchases.reduce((groups, purchase) => {
    const day = toDay(purchase.purchaseDate!)
    const entry = groups.get(day) ?? { count: 0, cents: 0 }
    entry.count++
    entry.cents += toCents(purchase.total ?? 0)
    return groups.set(day, entry)
  }, new Map<string, { count: number; cents: number }>())]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, entry]) => ({ date: excelDay(day), purchases: entry.count, total: fromCents(entry.cents) }))

  const products: Row[] = [...lineRows.reduce((groups, row) => {
    const sku = row.sku as string
    const entry = groups.get(sku) ?? { name: row.name as string, units: 0, cents: 0, min: Infinity, max: -Infinity }
    entry.units += row.quantity as number
    entry.cents += toCents(row.subtotal as number)
    entry.min = Math.min(entry.min, row.unitCost as number)
    entry.max = Math.max(entry.max, row.unitCost as number)
    return groups.set(sku, entry)
  }, new Map<string, { name: string; units: number; cents: number; min: number; max: number }>())]
    .map(([sku, entry]) => ({
      sku, name: entry.name, units: entry.units, cost: fromCents(entry.cents),
      average: entry.units ? fromCents(Math.round(entry.cents / entry.units)) : 0, min: entry.min, max: entry.max,
    }))
    .sort((a, b) => (b.cost as number) - (a.cost as number))

  const kpis: Kpi[] = [
    { label: t('purchases.stats.spent'), value: total, type: 'money', hint: t('excel.purchases.spentHint'),
      formula: (ref) => `SUM(${ref('TCompras', 'total')})` },
    { label: t('excel.purchases.count'), value: purchases.length, type: 'int', hint: t('excel.purchases.countHint'),
      formula: (ref) => `COUNTA(${ref('TCompras', 'id')})` },
    { label: t('purchases.stats.average'), value: purchases.length ? fromCents(Math.round(totalCents / purchases.length)) : 0,
      type: 'money', hint: t('purchases.stats.averageHint'), formula: (ref) => `IFERROR(AVERAGE(${ref('TCompras', 'total')}),0)` },
    { label: t('purchases.stats.suppliers'), value: suppliers.length, type: 'int', tone: 'muted', hint: t('purchases.stats.suppliersHint') },
    ...(details ? [
      { label: t('excel.units'), value: units, type: 'int' as const, tone: 'success' as const, hint: t('excel.purchases.unitsHint'),
        formula: (ref: (table: string, column: string) => string) => `SUM(${ref('TDetalleCompras', 'quantity')})` },
      { label: t('excel.purchases.products'), value: products.length, type: 'int' as const, tone: 'muted' as const,
        hint: t('excel.purchases.productsHint') },
    ] : []),
  ]

  const sheets: SheetSpec[] = [{
    name: t('excel.sheets.summary'),
    title: t('excel.purchases.title'),
    subtitle: period,
    info,
    sections: [
      { kind: 'kpis', title: t('excel.purchases.figures'), items: kpis },
      ...(truncated ? [{ kind: 'note' as const, text: t('purchases.exportTruncated', { count: purchases.length }) }] : []),
      {
        kind: 'pair',
        table: {
          kind: 'table',
          name: 'TProveedores',
          title: t('excel.purchases.bySupplier'),
          columns: [
            { key: 'name', header: t('purchases.columns.supplier'), width: 26 },
            { key: 'purchases', header: t('excel.purchases.count'), type: 'int', total: 'sum',
              formula: (cells, ref) => `COUNTIF(${ref('TCompras', 'supplier')},${cells.name})` },
            { key: 'total', header: t('purchases.columns.total'), type: 'money', total: 'sum', visual: 'bar',
              formula: (cells, ref) => `SUMIF(${ref('TCompras', 'supplier')},${cells.name},${ref('TCompras', 'total')})` },
            { key: 'share', header: t('excel.share'), type: 'percent', total: 'sum',
              formula: (cells, ref) => `IFERROR(${cells.total}/SUM(${ref('TProveedores', 'total')}),0)` },
            { key: 'last', header: t('excel.purchases.lastPurchase'), type: 'date' },
          ],
          rows: suppliers,
        },
        chart: { type: 'doughnut', title: t('excel.purchases.supplierShare'), table: 'TProveedores', category: 'name', series: [{ column: 'total' }], height: 15 },
      },
      ...(days.length > 0 ? [{
        kind: 'pair' as const,
        table: {
          kind: 'table' as const,
          name: 'TComprasDia',
          title: t('excel.purchases.byDay'),
          columns: [
            { key: 'date', header: t('purchases.columns.date'), type: 'date' as const },
            { key: 'purchases', header: t('excel.purchases.count'), type: 'int' as const, total: 'sum' as const },
            { key: 'total', header: t('purchases.columns.total'), type: 'money' as const, total: 'sum' as const },
          ],
          rows: days,
        },
        chart: {
          type: days.length > 31 ? 'line' as const : 'column' as const, title: t('excel.purchases.spentByDay'),
          table: 'TComprasDia', category: 'date', series: [{ column: 'total', color: '2F80C2' }],
          height: Math.min(Math.max(15, days.length + 3), 24),
        },
      }] : []),
      ...(details && products.length > 0 ? [{
        kind: 'pair' as const,
        table: {
          kind: 'table' as const,
          name: 'TProductosComprados',
          title: t('excel.purchases.byProduct'),
          columns: [
            { key: 'sku', header: t('inventory.columns.sku'), type: 'code' as const },
            { key: 'name', header: t('purchases.columns.product'), width: 26 },
            { key: 'units', header: t('excel.units'), type: 'int' as const, total: 'sum' as const,
              formula: (cells: Record<string, string>, ref: (table: string, column: string) => string) =>
                `SUMIF(${ref('TDetalleCompras', 'sku')},${cells.sku},${ref('TDetalleCompras', 'quantity')})` },
            { key: 'cost', header: t('excel.purchases.cost'), type: 'money' as const, total: 'sum' as const, visual: 'bar' as const,
              formula: (cells: Record<string, string>, ref: (table: string, column: string) => string) =>
                `SUMIF(${ref('TDetalleCompras', 'sku')},${cells.sku},${ref('TDetalleCompras', 'subtotal')})` },
            { key: 'average', header: t('excel.purchases.averageCost'), type: 'money' as const,
              formula: (cells: Record<string, string>) => `IFERROR(ROUND(${cells.cost}/${cells.units},2),0)` },
            { key: 'min', header: t('excel.purchases.minCost'), type: 'money' as const },
            { key: 'max', header: t('excel.purchases.maxCost'), type: 'money' as const },
          ],
          rows: products,
        },
        chart: {
          type: 'bar' as const, title: t('excel.purchases.topProductsChart'), table: 'TProductosComprados', category: 'name',
          series: [{ column: 'cost', color: '1C9A8A' }], height: Math.min(Math.max(15, products.length + 4), 26),
        },
      }] : [{ kind: 'note' as const, text: t('excel.purchases.noDetails', { count: purchases.length }) }]),
      { kind: 'links', label: t('excel.goTo'), sheets: details ? [purchasesSheet, t('excel.sheets.lines')] : [purchasesSheet] },
    ],
  }, {
    name: purchasesSheet,
    title: t('excel.purchases.listTitle'),
    subtitle: period,
    info,
    landscape: true,
    sections: [{
      kind: 'table',
      name: 'TCompras',
      main: true,
      columns: [
        { key: 'id', header: t('purchases.columns.folio'), type: 'int', width: 10 },
        { key: 'date', header: t('purchases.columns.date'), type: 'datetime' },
        { key: 'supplier', header: t('purchases.columns.supplier'), width: 28 },
        { key: 'recordedBy', header: t('purchases.columns.recordedBy'), width: 22 },
        ...(details ? [
          { key: 'lines', header: t('excel.purchases.products'), type: 'int' as const, total: 'sum' as const },
          { key: 'units', header: t('excel.units'), type: 'int' as const, total: 'sum' as const },
        ] : []),
        { key: 'total', header: t('purchases.columns.total'), type: 'money', total: 'sum', visual: 'bar' },
      ],
      rows: purchaseRows,
    }],
  }]

  if (details) {
    sheets.push({
      name: t('excel.sheets.lines'),
      title: t('excel.purchases.linesTitle'),
      subtitle: period,
      info,
      landscape: true,
      sections: [{
        kind: 'table',
        name: 'TDetalleCompras',
        main: true,
        columns: [
          { key: 'id', header: t('purchases.columns.folio'), type: 'int', width: 10 },
          { key: 'date', header: t('purchases.columns.date'), type: 'datetime' },
          { key: 'supplier', header: t('purchases.columns.supplier'), width: 26 },
          { key: 'sku', header: t('inventory.columns.sku'), type: 'code' },
          { key: 'name', header: t('purchases.columns.product'), width: 30 },
          { key: 'quantity', header: t('purchases.columns.quantity'), type: 'int', total: 'sum' },
          { key: 'unitCost', header: t('purchases.columns.unitCost'), type: 'money' },
          { key: 'subtotal', header: t('purchases.columns.subtotal'), type: 'money', total: 'sum', visual: 'bar',
            formula: (cells) => `${cells.quantity}*${cells.unitCost}` },
        ],
        rows: lineRows,
      }],
    })
  }
  return sheets
}
