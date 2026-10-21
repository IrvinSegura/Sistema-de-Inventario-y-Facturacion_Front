import type { TFunction } from 'i18next'

import { categoryName } from '@/features/categories/category-labels'
import type { Product } from '@/features/products/queries'
import { type Column, countExact, excelDate, type Kpi, type Row, type SheetSpec, sumExact } from '@/lib/excel'
import { fromCents, toCents, withTax } from '@/lib/money'

import { MOVEMENT_TYPES } from './movement-params'
import type { LowStockProduct, Movement, MovementType } from './queries'

const STATUS_COLORS = { ok: '58B368', low: 'E0A030', out: 'C2412D', inactive: '9CA3AF' }

function money(value: number) {
  return Math.round(value * 100) / 100
}

function stockStatus(t: TFunction, product: Product): string {
  if (!product.active) {
    return t('inventory.status.inactive')
  }
  const stock = product.stock ?? 0
  return stock <= 0 ? t('inventory.status.out') : product.lowStock ? t('inventory.status.low') : t('inventory.status.ok')
}

/** The text as a string literal for an Excel formula, with inner quotes doubled. */
function quote(text: string) {
  return `"${text.replace(/"/g, '""')}"`
}

/** Items grouped by a key, for the summary tables; groups keep first-seen order. */
function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>()
  items.forEach((item) => groups.set(key(item), [...(groups.get(key(item)) ?? []), item]))
  return groups
}

/**
 * Stock of every product, its value at sale price and a dashboard by category and status. Shortage,
 * status, price with VAT and value are formulas, so changing a stock or price in Excel updates the
 * whole report.
 */
export function stockWorkbook({ t, products, truncated, info }: {
  t: TFunction
  products: Product[]
  truncated: boolean
  info: [string, string][]
}): SheetSpec[] {
  const out = t('inventory.status.out')
  const low = t('inventory.status.low')
  const ok = t('inventory.status.ok')
  const inactive = t('inventory.status.inactive')

  const rows: Row[] = products.map((product) => {
    const stock = product.stock ?? 0
    const price = product.salePrice ?? 0
    return {
      sku: product.sku,
      barcode: product.barcode,
      name: product.name,
      category: categoryName(product.category?.name, t),
      stock,
      min: product.minStock,
      shortage: Math.max((product.minStock ?? 0) - stock, 0),
      status: stockStatus(t, product),
      price,
      vat: product.taxRate,
      priceWithVat: withTax(price, product.taxRate ?? 0),
      // Negative stock adds no units or value, here and in the formulas.
      value: fromCents(Math.max(stock, 0) * toCents(price)),
      active: product.active ? 1 : 0,
    }
  })
  const units = rows.reduce((sum, row) => sum + Math.max(row.stock as number, 0), 0)
  const value = fromCents(rows.reduce((sum, row) => sum + toCents(row.value as number), 0))
  const valueWithVat = money(rows.reduce((sum, row) => sum + Math.max(row.stock as number, 0) * (row.priceWithVat as number), 0))
  const count = (status: string) => rows.filter((row) => row.status === status).length

  const categories = [...groupBy(rows, (row) => row.category as string)].map(([category, list]) => {
    const total = fromCents(list.reduce((sum, row) => sum + toCents(row.value as number), 0))
    return {
      category,
      products: list.length,
      units: list.reduce((sum, row) => sum + Math.max(row.stock as number, 0), 0),
      value: total,
      share: value > 0 ? total / value : 0,
    }
  }).sort((a, b) => (b.value as number) - (a.value as number))

  const statuses = [
    { status: ok, products: count(ok), color: STATUS_COLORS.ok },
    { status: low, products: count(low), color: STATUS_COLORS.low },
    { status: out, products: count(out), color: STATUS_COLORS.out },
    { status: inactive, products: count(inactive), color: STATUS_COLORS.inactive },
  ].filter((row) => row.products > 0)

  const top = [...rows].sort((a, b) => (b.value as number) - (a.value as number)).slice(0, 10)
    .map((row, index) => ({ rank: index + 1, name: row.name, units: row.stock, value: row.value }))

  return [
    {
      name: t('excel.sheets.summary'),
      title: t('excel.stock.title'),
      subtitle: t('excel.stock.subtitle'),
      info,
      sections: [
        {
          kind: 'kpis',
          title: t('excel.stock.figures'),
          items: [
            { label: t('excel.stock.products'), value: rows.length, type: 'int', hint: t('excel.stock.productsHint'),
              formula: (ref) => `COUNTA(${ref('TStock', 'sku')})` },
            { label: t('excel.stock.units'), value: units, type: 'int', hint: t('excel.stock.unitsHint'),
              formula: (ref) => `SUMIF(${ref('TStock', 'stock')},">0")` },
            { label: t('excel.stock.value'), value, type: 'money', hint: t('excel.stock.valueHint'),
              formula: (ref) => `SUM(${ref('TStock', 'value')})` },
            { label: t('excel.stock.valueWithVat'), value: valueWithVat, type: 'money', hint: t('excel.stock.valueWithVatHint'),
              formula: (ref) => `SUMPRODUCT((${ref('TStock', 'stock')}>0)*${ref('TStock', 'stock')},${ref('TStock', 'priceWithVat')})` },
            { label: ok, value: count(ok), type: 'int', tone: 'success', hint: t('excel.stock.okHint'),
              formula: (ref) => `COUNTIF(${ref('TStock', 'status')},${quote(ok)})` },
            { label: low, value: count(low), type: 'int', tone: 'warning', hint: t('excel.stock.lowHint'),
              formula: (ref) => `COUNTIF(${ref('TStock', 'status')},${quote(low)})` },
            { label: out, value: count(out), type: 'int', tone: 'danger', hint: t('excel.stock.outHint'),
              formula: (ref) => `COUNTIF(${ref('TStock', 'status')},${quote(out)})` },
            { label: t('excel.stock.missingUnits'), value: rows.reduce((sum, row) => sum + (row.shortage as number), 0), type: 'int',
              tone: 'muted', hint: t('excel.stock.missingUnitsHint'), formula: (ref) => `SUM(${ref('TStock', 'shortage')})` },
          ],
        },
        ...(truncated ? [{ kind: 'note' as const, text: t('excel.truncated', { count: products.length }) }] : []),
        {
          kind: 'pair',
          table: {
            kind: 'table',
            name: 'TStockByCategory',
            title: t('excel.stock.byCategory'),
            columns: [
              { key: 'category', header: t('products.columns.category'), width: 22 },
              { key: 'products', header: t('excel.stock.products'), type: 'int', total: 'sum',
                formula: (cells, ref) => countExact(ref('TStock', 'category'), cells.category) },
              { key: 'units', header: t('excel.units'), type: 'int', total: 'sum',
                formula: (cells, ref) => sumExact(ref('TStock', 'category'), cells.category, ref('TStock', 'stock'), `${ref('TStock', 'stock')}>0`) },
              { key: 'value', header: t('excel.stock.value'), type: 'money', total: 'sum', visual: 'bar',
                formula: (cells, ref) => sumExact(ref('TStock', 'category'), cells.category, ref('TStock', 'value')) },
              { key: 'share', header: t('excel.share'), type: 'percent', total: 'sum',
                formula: (cells, ref) => `IFERROR(${cells.value}/SUM(${ref('TStockByCategory', 'value')}),0)` },
            ],
            rows: categories,
          },
          chart: { type: 'doughnut', title: t('excel.stock.valueByCategory'), table: 'TStockByCategory', category: 'category', series: [{ column: 'value' }] },
        },
        {
          kind: 'pair',
          table: {
            kind: 'table',
            name: 'TStatuses',
            title: t('excel.stock.byStatus'),
            columns: [
              { key: 'status', header: t('inventory.columns.status'), width: 22 },
              // Our own labels, never data: COUNTIF is safe here (data criteria use countExact).
              { key: 'products', header: t('excel.stock.products'), type: 'int', total: 'sum',
                formula: (cells, ref) => `COUNTIF(${ref('TStock', 'status')},${cells.status})` },
              { key: 'share', header: t('excel.share'), type: 'percent', total: 'sum',
                formula: (cells, ref) => `IFERROR(${cells.products}/SUM(${ref('TStatuses', 'products')}),0)` },
            ],
            rows: statuses.map((row) => ({ ...row, share: rows.length ? row.products / rows.length : 0 })),
          },
          chart: {
            type: 'pie', title: t('excel.stock.productsByStatus'), table: 'TStatuses', category: 'status',
            series: [{ column: 'products' }], colors: statuses.map((row) => row.color), height: 14,
          },
        },
        {
          kind: 'pair',
          table: {
            kind: 'table',
            name: 'TTopValue',
            title: t('excel.stock.topValue'),
            columns: [
              { key: 'rank', header: t('excel.rank'), type: 'int', width: 7 },
              { key: 'name', header: t('products.columns.product'), width: 28 },
              { key: 'units', header: t('excel.units'), type: 'int' },
              { key: 'value', header: t('excel.stock.value'), type: 'money', visual: 'bar' },
            ],
            rows: top,
          },
          chart: { type: 'bar', title: t('excel.stock.topValueChart'), table: 'TTopValue', category: 'name', series: [{ column: 'value' }] },
        },
        { kind: 'links', label: t('excel.goTo'), sheets: [t('excel.sheets.stock')] },
      ],
    },
    {
      name: t('excel.sheets.stock'),
      title: t('excel.stock.detail'),
      subtitle: t('excel.stock.detailSubtitle'),
      info,
      landscape: true,
      sections: [{
        kind: 'table',
        name: 'TStock',
        main: true,
        columns: [
          { key: 'sku', header: t('inventory.columns.sku'), type: 'code' },
          { key: 'barcode', header: t('inventory.columns.barcode'), type: 'code' },
          { key: 'name', header: t('products.columns.product'), width: 30 },
          { key: 'category', header: t('products.columns.category'), width: 18 },
          { key: 'stock', header: t('inventory.columns.stock'), type: 'int', total: 'sum', visual: 'bar' },
          { key: 'min', header: t('inventory.columns.min'), type: 'int' },
          { key: 'shortage', header: t('inventory.columns.shortage'), type: 'int', total: 'sum',
            formula: (cells) => `MAX(${cells.min}-${cells.stock},0)` },
          // Inactive products keep their label; the rest follow their stock.
          { key: 'status', header: t('inventory.columns.status'), width: 13,
            formula: (cells, _ref, row) => row.active
              ? `IF(${cells.stock}<=0,${quote(out)},IF(${cells.stock}<=${cells.min},${quote(low)},${quote(ok)}))`
              : undefined },
          { key: 'price', header: t('excel.stock.price'), type: 'money' },
          { key: 'vat', header: t('excel.stock.vatRate'), type: 'percent' },
          { key: 'priceWithVat', header: t('excel.stock.priceWithVat'), type: 'money',
            formula: (cells) => `ROUND(${cells.price}*(1+${cells.vat}),2)` },
          { key: 'value', header: t('excel.stock.value'), type: 'money', total: 'sum', visual: 'bar',
            formula: (cells) => `MAX(${cells.stock},0)*${cells.price}` },
        ],
        highlights: [
          { tone: 'danger', when: (cells) => `${cells.status}=${quote(out)}` },
          { tone: 'warning', when: (cells) => `${cells.status}=${quote(low)}` },
          { tone: 'muted', when: (cells) => `${cells.status}=${quote(inactive)}` },
        ],
        rows,
      }],
    },
  ]
}

/**
 * What has to be restocked, most urgent first, with a dashboard by category and the products
 * furthest from their minimum.
 */
export function lowStockWorkbook({ t, products, info }: {
  t: TFunction
  products: LowStockProduct[]
  info: [string, string][]
}): SheetSpec[] {
  const rows: Row[] = products.map((product, index) => {
    const stock = product.stock ?? 0
    const min = product.minStock ?? 0
    return {
      rank: index + 1,
      sku: product.sku,
      barcode: product.barcode,
      name: product.name,
      category: categoryName(product.category?.name, t),
      stock,
      min,
      coverage: min > 0 ? stock / min : 0,
      shortage: Math.max(min - stock, 0),
      // Keep in step with suggested() in LowStockPage and the column's formula below.
      suggested: Math.max(min - stock, 1),
    }
  })
  const out = rows.filter((row) => (row.stock as number) <= 0).length
  const toOrder = rows.reduce((sum, row) => sum + (row.suggested as number), 0)
  const categories = [...groupBy(rows, (row) => row.category as string)].map(([category, list]) => ({
    category,
    products: list.length,
    suggested: list.reduce((sum, row) => sum + (row.suggested as number), 0),
  })).sort((a, b) => b.suggested - a.suggested)
  const top = rows.slice(0, 15).map((row) => ({ name: row.name, stock: row.stock, min: row.min }))

  return [
    {
      name: t('excel.sheets.summary'),
      title: t('excel.lowStock.title'),
      subtitle: t('excel.lowStock.subtitle'),
      info,
      sections: [
        {
          kind: 'kpis',
          title: t('excel.lowStock.figures'),
          items: [
            { label: t('excel.lowStock.products'), value: rows.length, type: 'int', tone: 'warning', hint: t('excel.lowStock.productsHint'),
              formula: (ref) => `COUNTA(${ref('TLowStock', 'sku')})` },
            { label: t('inventory.status.out'), value: out, type: 'int', tone: 'danger', hint: t('excel.lowStock.outHint'),
              formula: (ref) => `COUNTIF(${ref('TLowStock', 'stock')},"<=0")` },
            { label: t('excel.lowStock.toOrder'), value: toOrder, type: 'int', hint: t('excel.lowStock.toOrderHint'),
              formula: (ref) => `SUM(${ref('TLowStock', 'suggested')})` },
            { label: t('excel.lowStock.coverage'), value: rows.length ? rows.reduce((sum, row) => sum + (row.coverage as number), 0) / rows.length : 0,
              type: 'percent', tone: 'muted', hint: t('excel.lowStock.coverageHint'),
              formula: (ref) => `IFERROR(AVERAGE(${ref('TLowStock', 'coverage')}),0)` },
          ],
        },
        { kind: 'note', text: t('excel.lowStock.note') },
        {
          kind: 'pair',
          table: {
            kind: 'table',
            name: 'TRestockByCategory',
            title: t('excel.lowStock.byCategory'),
            columns: [
              { key: 'category', header: t('products.columns.category'), width: 22 },
              { key: 'products', header: t('excel.lowStock.products'), type: 'int', total: 'sum',
                formula: (cells, ref) => countExact(ref('TLowStock', 'category'), cells.category) },
              { key: 'suggested', header: t('inventory.columns.suggested'), type: 'int', total: 'sum', visual: 'bar',
                formula: (cells, ref) => sumExact(ref('TLowStock', 'category'), cells.category, ref('TLowStock', 'suggested')) },
            ],
            rows: categories,
          },
          chart: { type: 'column', title: t('excel.lowStock.toOrderByCategory'), table: 'TRestockByCategory', category: 'category', series: [{ column: 'suggested', color: 'E0A030' }] },
        },
        {
          kind: 'pair',
          table: {
            kind: 'table',
            name: 'TMostUrgent',
            title: t('excel.lowStock.mostUrgent'),
            columns: [
              { key: 'name', header: t('products.columns.product'), width: 28 },
              { key: 'stock', header: t('inventory.columns.stock'), type: 'int' },
              { key: 'min', header: t('inventory.columns.min'), type: 'int' },
            ],
            rows: top,
          },
          chart: {
            type: 'bar', title: t('excel.lowStock.stockVsMin'), table: 'TMostUrgent', category: 'name',
            series: [{ column: 'stock', color: 'C2412D' }, { column: 'min', color: 'C9D6E8' }], height: 18,
          },
        },
        { kind: 'links', label: t('excel.goTo'), sheets: [t('excel.sheets.lowStock')] },
      ],
    },
    {
      name: t('excel.sheets.lowStock'),
      title: t('excel.lowStock.detail'),
      subtitle: t('excel.lowStock.subtitle'),
      info,
      landscape: true,
      sections: [{
        kind: 'table',
        name: 'TLowStock',
        main: true,
        columns: [
          { key: 'rank', header: t('excel.rank'), type: 'int', width: 7 },
          { key: 'sku', header: t('inventory.columns.sku'), type: 'code' },
          { key: 'barcode', header: t('inventory.columns.barcode'), type: 'code' },
          { key: 'name', header: t('products.columns.product'), width: 30 },
          { key: 'category', header: t('products.columns.category'), width: 18 },
          { key: 'stock', header: t('inventory.columns.stock'), type: 'int', total: 'sum' },
          { key: 'min', header: t('inventory.columns.min'), type: 'int', total: 'sum' },
          { key: 'coverage', header: t('excel.lowStock.coverage'), type: 'percent', visual: 'bar',
            formula: (cells) => `IF(${cells.min}>0,${cells.stock}/${cells.min},0)` },
          { key: 'shortage', header: t('inventory.columns.shortage'), type: 'int', total: 'sum', color: 'danger',
            formula: (cells) => `MAX(${cells.min}-${cells.stock},0)` },
          { key: 'suggested', header: t('inventory.columns.suggested'), type: 'int', total: 'sum',
            formula: (cells) => `MAX(${cells.min}-${cells.stock},1)` },
        ],
        highlights: [{ tone: 'danger', when: (cells) => `${cells.stock}<=0` }],
        rows,
      }],
    },
  ]
}

// The two movement workbooks share their rows, units in and out, and detail columns, so both
// count a movement the same way.
function movementRows(movements: Movement[], reference: (movement: Movement) => string, extra: (movement: Movement) => Row) {
  // The API lists newest first; a ledger reads from the oldest.
  return [...movements].reverse().map((movement): Row => {
    const quantity = movement.quantity ?? 0
    return {
      date: excelDate(movement.movementDate!),
      ...extra(movement),
      reference: reference(movement),
      entry: quantity > 0 ? quantity : null,
      exit: quantity < 0 ? -quantity : null,
      stock: movement.resultingStock,
      recordedBy: movement.recordedBy?.name,
    }
  })
}

function unitsOf(rows: Row[], key: 'entry' | 'exit') {
  return rows.reduce((sum, row) => sum + ((row[key] as number | null) ?? 0), 0)
}

function flowKpis(t: TFunction, table: string, rows: Row[]): Kpi[] {
  const entries = unitsOf(rows, 'entry')
  const exits = unitsOf(rows, 'exit')
  return [
    { label: t('excel.ledger.entries'), value: entries, type: 'int', tone: 'success', hint: t('excel.ledger.entriesHint'),
      formula: (ref) => `SUM(${ref(table, 'entry')})` },
    { label: t('excel.ledger.exits'), value: exits, type: 'int', tone: 'danger', hint: t('excel.ledger.exitsHint'),
      formula: (ref) => `SUM(${ref(table, 'exit')})` },
    { label: t('excel.ledger.net'), value: entries - exits, type: 'int', hint: t('excel.ledger.netHint'),
      formula: (ref) => `SUM(${ref(table, 'entry')})-SUM(${ref(table, 'exit')})` },
  ]
}

// The detail table's columns, with what tells the movements apart (type or product) second.
function movementColumns(t: TFunction, second: Column): Column[] {
  return [
    { key: 'date', header: t('inventory.ledger.columns.date'), type: 'datetime' },
    second,
    { key: 'reference', header: t('inventory.ledger.columns.reference'), width: 34 },
    { key: 'entry', header: t('excel.ledger.entry'), type: 'int', total: 'sum', color: 'success' },
    { key: 'exit', header: t('excel.ledger.exit'), type: 'int', total: 'sum', color: 'danger' },
    { key: 'stock', header: t('inventory.ledger.columns.stock'), type: 'int', visual: 'bar' },
    { key: 'recordedBy', header: t('inventory.ledger.columns.recordedBy'), width: 24 },
  ]
}

/**
 * Classic kardex in date order with entries and exits apart, the stock after each movement, a
 * dashboard by movement type and the stock over time. Takes the movements newest first, as the
 * API lists them.
 */
export function ledgerWorkbook({ t, product, movements, truncated, period, info, reference }: {
  t: TFunction
  product: Product
  movements: Movement[]
  truncated: boolean
  period: string
  info: [string, string][]
  reference: (movement: Movement) => string
}): SheetSpec[] {
  const rows = movementRows(movements, reference, (movement) => ({ type: t(`inventory.types.${movement.type!}`) }))
  const types = MOVEMENT_TYPES.map((type) => {
    const label = t(`inventory.types.${type}`)
    const list = rows.filter((row) => row.type === label)
    return { type: label, movements: list.length, entries: unitsOf(list, 'entry'), exits: unitsOf(list, 'exit') }
  })

  return [
    {
      name: t('excel.sheets.summary'),
      title: t('excel.ledger.title', { name: product.name }),
      subtitle: period,
      info: [
        [t('inventory.columns.sku'), product.sku ?? ''],
        [t('inventory.columns.barcode'), product.barcode ?? '—'],
        [t('products.columns.category'), categoryName(product.category?.name, t)],
        [t('inventory.columns.status'), stockStatus(t, product)],
        ...info,
      ],
      sections: [
        {
          kind: 'kpis',
          title: t('excel.ledger.figures'),
          items: [
            // From the product, with no formula: the rows may be filtered or cut short, so they can't give today's stock.
            { label: t('excel.ledger.currentStock'), value: product.stock, type: 'int', hint: t('excel.ledger.minimum', { count: product.minStock }) },
            { label: t('excel.ledger.movements'), value: rows.length, type: 'int', tone: 'muted', hint: period,
              formula: (ref) => `COUNTA(${ref('TLedger', 'type')})` },
            ...flowKpis(t, 'TLedger', rows),
          ],
        },
        ...(truncated ? [{ kind: 'note' as const, text: t('inventory.ledger.exportTruncated', { count: movements.length }) }] : []),
        {
          kind: 'pair',
          table: {
            kind: 'table',
            name: 'TMovementTypes',
            title: t('excel.ledger.byType'),
            columns: [
              { key: 'type', header: t('inventory.ledger.columns.type'), width: 20 },
              // Our own labels, never data: COUNTIF is safe here (data criteria use countExact).
              { key: 'movements', header: t('excel.ledger.movements'), type: 'int', total: 'sum',
                formula: (cells, ref) => `COUNTIF(${ref('TLedger', 'type')},${cells.type})` },
              { key: 'entries', header: t('excel.ledger.entry'), type: 'int', total: 'sum', color: 'success',
                formula: (cells, ref) => `SUMIF(${ref('TLedger', 'type')},${cells.type},${ref('TLedger', 'entry')})` },
              { key: 'exits', header: t('excel.ledger.exit'), type: 'int', total: 'sum', color: 'danger',
                formula: (cells, ref) => `SUMIF(${ref('TLedger', 'type')},${cells.type},${ref('TLedger', 'exit')})` },
            ],
            rows: types,
          },
          chart: {
            type: 'column', title: t('excel.ledger.inAndOut'), table: 'TMovementTypes', category: 'type',
            series: [{ column: 'entries', color: '58B368' }, { column: 'exits', color: 'C2412D' }], height: 14,
          },
        },
        // An area chart needs at least two points.
        ...(rows.length > 1 ? [{
          kind: 'chart' as const,
          chart: { type: 'area' as const, title: t('excel.ledger.stockOverTime'), table: 'TLedger', category: 'date', series: [{ column: 'stock' }] },
        }] : []),
        { kind: 'links', label: t('excel.goTo'), sheets: [t('excel.sheets.ledger')] },
      ],
    },
    {
      name: t('excel.sheets.ledger'),
      title: t('excel.ledger.title', { name: product.name }),
      subtitle: period,
      info: [[t('inventory.columns.sku'), product.sku ?? ''], ...info],
      landscape: true,
      sections: [{
        kind: 'table',
        name: 'TLedger',
        main: true,
        columns: movementColumns(t, { key: 'type', header: t('inventory.ledger.columns.type'), width: 18 }),
        rows,
      }],
    },
  ]
}

/**
 * One type of movement across the store (e.g. a month's adjustments): the totals, the same by
 * product (most movements first) and every movement in date order. Takes the movements newest
 * first, as the API lists them.
 */
export function storeLedgerWorkbook({ t, type, movements, truncated, period, reference }: {
  t: TFunction
  type: MovementType
  movements: Movement[]
  truncated: boolean
  period: string
  reference: (movement: Movement) => string
}): SheetSpec[] {
  const typeLabel = t(`inventory.types.${type}`)
  const title = t('excel.storeLedger.title', { type: typeLabel })
  const rows = movementRows(movements, reference, (movement) => ({ product: movement.productName }))
  const products = [...groupBy(rows, (row) => String(row.product ?? '')).entries()]
    .map(([product, list]) => ({ product, movements: list.length, entries: unitsOf(list, 'entry'), exits: unitsOf(list, 'exit') }))
    .sort((a, b) => b.movements - a.movements || a.product.localeCompare(b.product))
  const info: [string, string][] = [[t('inventory.ledger.columns.type'), typeLabel]]

  return [
    {
      name: t('excel.sheets.summary'),
      title,
      subtitle: period,
      info,
      sections: [
        {
          kind: 'kpis',
          title: t('excel.ledger.figures'),
          items: [
            { label: t('excel.ledger.movements'), value: rows.length, type: 'int', tone: 'muted', hint: period,
              formula: (ref) => `COUNTA(${ref('TMovements', 'product')})` },
            { label: t('excel.storeLedger.products'), value: products.length, type: 'int', tone: 'muted',
              formula: (ref) => `ROWS(${ref('TProducts', 'product')})` },
            ...flowKpis(t, 'TMovements', rows),
          ],
        },
        ...(truncated ? [{ kind: 'note' as const, text: t('inventory.ledger.exportTruncated', { count: movements.length }) }] : []),
        {
          kind: 'table',
          name: 'TProducts',
          title: t('excel.storeLedger.byProduct'),
          columns: [
            { key: 'product', header: t('inventory.ledger.columns.product'), width: 34 },
            { key: 'movements', header: t('excel.ledger.movements'), type: 'int', total: 'sum',
              formula: (cells, ref) => countExact(ref('TMovements', 'product'), cells.product) },
            { key: 'entries', header: t('excel.ledger.entry'), type: 'int', total: 'sum', color: 'success',
              formula: (cells, ref) => sumExact(ref('TMovements', 'product'), cells.product, ref('TMovements', 'entry')) },
            { key: 'exits', header: t('excel.ledger.exit'), type: 'int', total: 'sum', color: 'danger',
              formula: (cells, ref) => sumExact(ref('TMovements', 'product'), cells.product, ref('TMovements', 'exit')) },
          ],
          rows: products,
        },
        { kind: 'links', label: t('excel.goTo'), sheets: [t('excel.sheets.movements')] },
      ],
    },
    {
      name: t('excel.sheets.movements'),
      title,
      subtitle: period,
      info,
      landscape: true,
      sections: [{
        kind: 'table',
        name: 'TMovements',
        main: true,
        columns: movementColumns(t, { key: 'product', header: t('inventory.ledger.columns.product'), width: 30 }),
        rows,
      }],
    },
  ]
}
