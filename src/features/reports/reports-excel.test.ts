// @vitest-environment jsdom
// jsdom: the builders import the API client, which loads i18n (it touches document); its DOMParser
// also checks that every XML part of the file is well formed.
import ExcelJS from 'exceljs'
import { createInstance, type TFunction } from 'i18next'
import JSZip from 'jszip'
import { beforeAll, describe, expect, it } from 'vitest'

import { es } from '@/i18n/locales/es'
import { type ReportMeta, type SheetSpec, workbookBuffer } from '@/lib/excel'

import { centsByDay, comparisonSeries, flowSeries } from './periods'
import { cashClosingWorkbook, cashFlowWorkbook, customerSalesWorkbook, productSalesWorkbook, salesReportWorkbook } from './reports-excel'

const meta: ReportMeta = {
  storeName: 'Inventario y Facturación',
  author: 'Ana Admin',
  generatedLabel: 'Generado',
  generatedByLabel: 'Generado por',
  pageLabel: 'Página &P de &N',
  emptyLabel: 'No hay datos con estos filtros.',
  totalLabel: 'Total',
  locale: 'es-MX',
}

let t: TFunction

beforeAll(async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'es', resources: { es: { translation: es } }, interpolation: { escapeValue: false } })
  t = i18n.t
})

async function build(sheets: SheetSpec[]) {
  const buffer = await workbookBuffer(sheets, meta)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const zip = await JSZip.loadAsync(buffer)
  for (const path of Object.keys(zip.files).filter((name) => /\.(xml|rels)$/.test(name))) {
    const doc = new DOMParser().parseFromString(await zip.file(path)!.async('string'), 'application/xml')
    expect(doc.getElementsByTagName('parsererror'), path).toHaveLength(0)
  }
  return workbook
}

function find(sheet: ExcelJS.Worksheet, text: string) {
  let found: { row: number; col: number } | null = null
  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      if (!found && cell.value === text) {
        found = { row: rowNumber, col: colNumber }
      }
    })
  })
  if (!found) {
    throw new Error(`"${text}" not found in ${sheet.name}`)
  }
  return found as { row: number; col: number }
}

describe('sales report workbook', () => {
  const report = {
    completed: { saleCount: 2, subtotal: 150, tax: 24, total: 174 },
    cancelled: { saleCount: 1, subtotal: 50, tax: 8, total: 58 },
    averageTicket: 87,
    byPaymentMethod: [{ paymentMethod: 'CASH' as const, saleCount: 2, total: 174 }],
    bySeller: [{ sellerId: 3, name: 'Luis', saleCount: 2, total: 174 }],
    topProducts: [{ productId: 1, sku: 'ARROZ-1', name: 'Arroz', quantity: 4, subtotal: 150 }],
    byDay: [{ date: '2026-10-18', saleCount: 2, total: 174 }],
  }
  const previous = { ...report, completed: { saleCount: 1, subtotal: 100, tax: 16, total: 116 }, bySeller: [], byDay: [] }
  const range = { from: '2026-10-18', to: '2026-10-19' }
  const daily = (days: { date?: string; total?: number }[]) => centsByDay(days, (day) => day.date, (day) => day.total)

  it('compares every money figure with the previous period using formulas', async () => {
    const workbook = await build(salesReportWorkbook({
      t, language: 'es', report, previous, grouping: 'day', period: 'Periodo', previousPeriod: 'Anterior', seller: 'Todos',
      showSellers: true,
      series: comparisonSeries(range, 'day', daily(report.byDay), daily([])),
    }))
    const sheet = workbook.getWorksheet('Resumen')!
    const header = find(sheet, 'Cifra')
    const sales = sheet.getRow(header.row + 1)
    expect(sales.getCell(1).value).toBe('Ventas')
    expect(sales.getCell(5).value).toMatchObject({ formula: expect.stringContaining('ABS('), result: 0.5 })
    // A seller who sold nothing before is "new": no percentage.
    const seller = find(sheet, 'Luis')
    expect(sheet.getCell(seller.row, seller.col + 5).value).toBeNull()
  })

  it('leaves the comparison out when there is no previous period', async () => {
    const workbook = await build(salesReportWorkbook({
      t, language: 'es', report, grouping: 'day', period: 'Periodo', seller: 'Todos', showSellers: true,
      series: comparisonSeries(range, 'day', daily(report.byDay), daily([])),
    }))
    expect(() => find(workbook.getWorksheet('Resumen')!, 'Cifra')).toThrow()
  })
})

describe('cash closing workbook', () => {
  it('computes the difference only for closed drawers', async () => {
    const amounts = { saleCount: 2, salesTotal: 300, cancellationCount: 1, cancellationsTotal: 50, net: 250 }
    const workbook = await build(cashClosingWorkbook({
      t, date: '18 de octubre', seller: 'Todos', status: 'Día cerrado',
      closing: {
        closed: true,
        byPaymentMethod: { CASH: amounts, CARD: { saleCount: 0, salesTotal: 0, cancellationCount: 0, cancellationsTotal: 0, net: 0 } },
        total: amounts,
        bySeller: [{ seller: { id: 3, name: 'Luis' }, cash: amounts, total: amounts }],
        openingFloat: 1000,
        expectedCash: 1250,
        drawers: [
          { id: 1, responsible: { name: 'Luis' }, members: [{ name: 'Luis' }], openingFloat: 500, openedAt: '2026-10-18T14:00:00Z',
            closing: { closedAt: '2026-10-18T23:00:00Z', expectedCash: 750, countedCash: 740, difference: -10 } },
          { id: 2, responsible: { name: 'Eva' }, members: [{ name: 'Eva' }], openingFloat: 500, openedAt: '2026-10-18T14:00:00Z' },
        ],
      },
    }))
    const sheet = workbook.getWorksheet('Corte')!
    const header = find(sheet, 'Responsable')
    expect(sheet.getRow(header.row + 1).getCell(8).value).toMatchObject({ formula: `G${header.row + 1}-F${header.row + 1}`, result: -10 })
    expect(sheet.getRow(header.row + 2).getCell(8).value).toBeNull()
  })
})

describe('cash flow workbook', () => {
  it('adds up money in and out with formulas over the table', async () => {
    const range = { from: '2026-10-01', to: '2026-10-02' }
    const series = flowSeries(range, 'day', centsByDay([{ day: '2026-10-01', total: 200 }], (row) => row.day, (row) => row.total),
      centsByDay([{ day: '2026-10-02', total: 80 }], (row) => row.day, (row) => row.total))
    const workbook = await build(cashFlowWorkbook({ t, language: 'es', series, grouping: 'day', period: 'Periodo' }))
    const sheet = workbook.getWorksheet('Ingresos y egresos')!
    const card = find(sheet, 'FLUJO NETO')
    expect(sheet.getCell(card.row + 1, card.col).value).toMatchObject({ formula: expect.stringContaining('SUM('), result: 120 })
  })
})

describe('product and customer workbooks', () => {
  const product = {
    productId: 1, sku: 'ARROZ-1', name: 'Arroz', category: { id: 1, name: 'Pantry' }, active: true, stock: 7,
    averageCost: 4.5, lastSaleDate: '2026-10-18T18:00:00Z',
  }

  it('computes gross profit and margin only when the cost is known', async () => {
    const workbook = await build(productSalesWorkbook({
      t, unsold: false, period: 'Periodo', info: [], truncated: false,
      rows: [
        { ...product, quantity: 3, subtotal: 30, cost: 12, grossProfit: 18 },
        { ...product, productId: 2, sku: 'JABON-1', name: 'Jabón', quantity: 1, subtotal: 10, cost: undefined, grossProfit: undefined },
      ],
    }))
    const sheet = workbook.getWorksheet('Productos')!
    const header = find(sheet, 'SKU')
    // SKU, product, category, status, units, amount, cost, profit, margin.
    expect(sheet.getRow(header.row + 1).getCell(8).value).toMatchObject({ formula: expect.stringContaining('-'), result: 18 })
    expect(sheet.getRow(header.row + 1).getCell(9).value).toMatchObject({ result: 0.6 })
    expect(sheet.getRow(header.row + 2).getCell(8).value).toBeNull()
  })

  it('values the unsold stock at its average cost', async () => {
    const workbook = await build(productSalesWorkbook({
      t, unsold: true, period: 'Periodo', info: [], truncated: false,
      rows: [{ ...product, quantity: 0, subtotal: 0, cost: 0, grossProfit: 0 }],
    }))
    const sheet = workbook.getWorksheet('Sin venta')!
    const header = find(sheet, 'SKU')
    expect(sheet.getRow(header.row + 1).getCell(6).value).toMatchObject({ result: 31.5 })
  })

  it('ranks customers with their share of the total', async () => {
    const workbook = await build(customerSalesWorkbook({
      t, period: 'Periodo', truncated: false,
      rows: [
        { customerId: 1, name: 'Ana', taxId: 'AAA010101AAA', saleCount: 2, total: 75, averageTicket: 37.5, lastSaleDate: '2026-10-18T18:00:00Z' },
        { customerId: 2, name: 'Luis', saleCount: 1, total: 25, averageTicket: 25, lastSaleDate: '2026-10-17T18:00:00Z' },
      ],
    }))
    const sheet = workbook.getWorksheet('Clientes')!
    const ana = find(sheet, 'Ana')
    expect(sheet.getCell(ana.row, ana.col + 5).value).toMatchObject({ result: 0.75 })
  })
})
