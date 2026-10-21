// @vitest-environment jsdom
// jsdom: the report builders import the API client, which loads i18n (it touches document); its
// DOMParser also checks that every XML part of the file is well formed.
import ExcelJS from 'exceljs'
import { createInstance, type TFunction } from 'i18next'
import JSZip from 'jszip'
import { beforeAll, describe, expect, it } from 'vitest'

import { ledgerWorkbook, stockWorkbook } from '@/features/inventory/inventory-reports'
import { salesWorkbook } from '@/features/sales/sales-report'
import { es } from '@/i18n/locales/es'

import { excelDate, excelDay, excelStoreDay, type ReportMeta, type SheetSpec, workbookBuffer } from './excel'

const meta: ReportMeta = {
  storeName: 'Inventario y Facturación',
  author: 'Ana Admin',
  generatedLabel: 'Generado',
  generatedByLabel: 'Generado por',
  pageLabel: 'Página &P de &N',
  emptyLabel: 'No hay datos con estos filtros.',
  totalLabel: 'Total',
  language: 'es',
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
  return { workbook, zip }
}

async function xml(zip: JSZip, path: string) {
  return zip.file(path)!.async('string')
}

// Every XML part parses; a malformed one makes Excel offer to repair the file.
async function expectWellFormed(zip: JSZip) {
  for (const path of Object.keys(zip.files).filter((name) => /\.(xml|rels)$/.test(name))) {
    const doc = new DOMParser().parseFromString(await xml(zip, path), 'application/xml')
    expect(doc.getElementsByTagName('parsererror'), path).toHaveLength(0)
  }
}

// Row and column of the first cell with this value.
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

// Every Date under a "date" key in the sheets' rows, as ISO strings.
function dateCells(specs: SheetSpec[]): string[] {
  const found: string[] = []
  const walk = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(walk)
    } else if (value && typeof value === 'object' && !(value instanceof Date)) {
      for (const [key, inner] of Object.entries(value)) {
        if (key === 'date' && inner instanceof Date) {
          found.push(inner.toISOString())
        } else {
          walk(inner)
        }
      }
    }
  }
  walk(specs)
  return found
}

function sale(number: number, status: 'COMPLETED' | 'CANCELLED', total: number, paymentMethod: 'CASH' | 'CARD' = 'CASH') {
  return {
    id: number, saleNumber: number, saleDate: `2026-10-18T1${number % 10}:00:00Z`, customer: { name: 'Público en general' },
    seller: { name: 'Luis' }, paymentMethod, status, total,
  }
}

describe('excel dates', () => {
  it("keeps the store's wall-clock time, not the machine's", () => {
    // 19:45 UTC is 13:45 in Mexico City (UTC−6).
    expect(excelDate('2026-10-19T19:45:00Z', 'America/Mexico_City')?.toISOString()).toBe('2026-10-19T13:45:00.000Z')
    expect(excelDate(new Date('2026-10-19T19:45:00Z'), 'UTC')?.toISOString()).toBe('2026-10-19T19:45:00.000Z')
    expect(excelDay('2026-10-01').toISOString()).toBe('2026-10-01T00:00:00.000Z')
  })

  it('writes the store day an instant falls on for day columns', () => {
    // 05:30 UTC is still the previous evening in Mexico City.
    expect(excelStoreDay('2026-10-19T05:30:00Z', 'America/Mexico_City')?.toISOString()).toBe('2026-10-18T00:00:00.000Z')
  })

  it('leaves the cell empty for a missing or malformed instant instead of failing the export', () => {
    expect(excelDate(undefined)).toBeUndefined()
    expect(excelDate(null)).toBeUndefined()
    expect(excelDate('not a date')).toBeUndefined()
    expect(excelStoreDay('not a date')).toBeUndefined()
  })
})

describe('sales workbook', () => {
  const report = {
    completed: { saleCount: 2, subtotal: 150, tax: 24, total: 174 },
    cancelled: { saleCount: 1, subtotal: 50, tax: 8, total: 58 },
    averageTicket: 87,
    byPaymentMethod: [{ paymentMethod: 'CASH' as const, saleCount: 1, total: 100 }, { paymentMethod: 'CARD' as const, saleCount: 1, total: 74 }],
    bySeller: [{ sellerId: 3, name: 'Luis', saleCount: 2, total: 174 }],
    topProducts: [{ productId: 1, sku: 'ARROZ-1', name: 'Arroz', quantity: 4, subtotal: 150 }],
    byDay: [{ date: '2026-10-18', saleCount: 2, total: 174 }],
  }
  const sales = [sale(10, 'COMPLETED', 100), sale(11, 'CANCELLED', 58), sale(12, 'COMPLETED', 74, 'CARD')]

  it('builds a dashboard with live figures and an Excel table of tickets', async () => {
    const { workbook, zip } = await build(salesWorkbook({
      t, sales, truncated: false, report, live: true, period: 'Periodo', info: [['Vendedor', 'Todos']],
    }))
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Resumen', 'Ventas'])
    await expectWellFormed(zip)

    const tickets = workbook.getWorksheet('Ventas')!
    const header = find(tickets, 'Ticket')
    expect(tickets.views[0].state).not.toBe('frozen')
    const first = tickets.getRow(header.row + 1)
    expect(first.getCell(1).value).toBe(10)
    expect(first.getCell(2).value).toBeInstanceOf(Date)
    expect(first.getCell(7).numFmt).toContain('#,##0.00')

    // A real table with a totals row that adds only completed sales.
    const tables = await Promise.all(Object.keys(zip.files).filter((name) => /^xl\/tables\/table\d+\.xml$/.test(name)).map((name) => xml(zip, name)))
    expect(tables.some((text) => text.includes('name="TVentas"') && text.includes('totalsRowCount="1"'))).toBe(true)
    const totals = tickets.getRow(header.row + 4).getCell(7).value as { formula: string }
    expect(totals.formula).toBe('SUMIF(TVentas[Estado],"Completada",TVentas[Total])')

    // Figure cards are formulas over the tickets sheet.
    const summary = workbook.getWorksheet('Resumen')!
    const sales0 = find(summary, 'VENTAS')
    const value = summary.getCell(sales0.row + 1, sales0.col).value as { formula: string; result: number }
    expect(value.formula).toBe(`SUMIF('Ventas'!$F$${header.row + 1}:$F$${header.row + 3},"Completada",'Ventas'!$G$${header.row + 1}:$G$${header.row + 3})`)
    expect(value.result).toBe(174)
  })

  it('adds native charts linked to the sheet and brands the theme', async () => {
    const { zip } = await build(salesWorkbook({ t, sales, truncated: false, report, live: true, period: '', info: [] }))
    const charts = Object.keys(zip.files).filter((name) => /^xl\/charts\/chart\d+\.xml$/.test(name))
    expect(charts.length).toBe(4)
    const types = await xml(zip, '[Content_Types].xml')
    expect(types).toContain('/xl/charts/chart1.xml')
    expect(types).toContain('/xl/drawings/drawing1.xml')
    const sheet = await xml(zip, 'xl/worksheets/sheet1.xml')
    // <drawing> goes after the footer and before <tableParts>, as the schema requires.
    expect(sheet.indexOf('<drawing r:id=')).toBeGreaterThan(sheet.indexOf('</headerFooter>'))
    expect(sheet.indexOf('<drawing r:id=')).toBeLessThan(sheet.indexOf('<tableParts'))
    // The link to the tickets sheet is an in-document one.
    expect(sheet).toMatch(/<hyperlink ref="[A-Z]+\d+" location="&apos;Ventas&apos;!A1"\/>/)
    expect(await xml(zip, 'xl/worksheets/_rels/sheet1.xml.rels')).not.toContain('TargetMode="External"')
    expect(await xml(zip, 'xl/worksheets/_rels/sheet1.xml.rels')).toContain('../drawings/drawing1.xml')
    const doughnut = await Promise.all(charts.map((name) => xml(zip, name)))
    expect(doughnut.some((text) => text.includes('<c:doughnutChart>') && text.includes("'Resumen'!$C$"))).toBe(true)
    expect(await xml(zip, 'xl/theme/theme1.xml')).toContain('<a:accent1><a:srgbClr val="1E3A5F"/></a:accent1>')
  })

  it('keeps the server figures when the tickets are filtered', async () => {
    const { workbook } = await build(salesWorkbook({ t, sales, truncated: false, report, live: false, period: '', info: [] }))
    const summary = workbook.getWorksheet('Resumen')!
    const sales0 = find(summary, 'VENTAS')
    expect(summary.getCell(sales0.row + 1, sales0.col).value).toBe(174)
  })

  it("groups the tickets by the store's day when there is no report", () => {
    // 23:30 on Oct 18 in the store (the default America/Mexico_City), already Oct 19 in UTC.
    const late = { ...sale(1, 'COMPLETED', 100), saleDate: '2026-10-19T05:30:00Z' }

    const days = dateCells(salesWorkbook({ t, sales: [late], truncated: false, live: false, period: '', info: [] }))

    expect(days.length).toBeGreaterThan(0)
    expect(days.every((day) => day.startsWith('2026-10-18'))).toBe(true)
  })

  it('shows an empty tickets sheet without a table', async () => {
    const { workbook, zip } = await build(salesWorkbook({ t, sales: [], truncated: false, live: false, period: '', info: [] }))
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Resumen', 'Ventas'])
    find(workbook.getWorksheet('Ventas')!, 'No hay datos con estos filtros.')
    await expectWellFormed(zip)
  })
})

describe('inventory workbooks', () => {
  it('computes shortage, status and value with formulas', async () => {
    const { workbook, zip } = await build(stockWorkbook({
      t, truncated: false, info: [],
      products: [
        { id: 1, sku: 'ARROZ-1', name: 'Arroz', category: { name: 'Pantry' }, stock: 10, minStock: 5, lowStock: false,
          active: true, salePrice: 20, taxRate: 0.16 },
        { id: 2, sku: 'JABON-1', name: 'Jabón', category: { name: 'Cleaning' }, stock: 0, minStock: 3, lowStock: true,
          active: true, salePrice: 15, taxRate: 0.16 },
      ],
    }))
    await expectWellFormed(zip)
    const sheet = workbook.getWorksheet('Existencias')!
    const header = find(sheet, 'SKU')
    const rice = sheet.getRow(header.row + 1)
    expect(rice.getCell(4).value).toBe('Abarrotes')
    expect(rice.getCell(12).value).toMatchObject({ formula: `MAX(E${header.row + 1},0)*I${header.row + 1}`, result: 200 })
    expect(rice.getCell(8).value).toMatchObject({ result: 'Bien' })
    expect(sheet.getRow(header.row + 2).getCell(8).value).toMatchObject({ result: 'Agotado' })
    expect(rice.getCell(10).numFmt).toBe('0.0%')
    expect(await xml(zip, 'xl/worksheets/sheet2.xml')).toContain('<conditionalFormatting')

    const summary = workbook.getWorksheet('Resumen')!
    const category = find(summary, 'Abarrotes')
    expect(summary.getCell(category.row, category.col + 1).value).toMatchObject({ formula: expect.stringContaining('COUNTIF(') })
  })

  it('lists the ledger from the oldest movement with entries and exits apart', async () => {
    const { workbook, zip } = await build(ledgerWorkbook({
      t, truncated: false, period: 'Todas las fechas', info: [],
      product: { id: 1, sku: 'ARROZ-1', name: 'Arroz', stock: 7, minStock: 5, active: true },
      reference: (movement) => movement.type ?? '',
      movements: [
        { id: 2, type: 'SALE', quantity: -3, resultingStock: 7, movementDate: '2026-10-18T16:00:00Z', recordedBy: { name: 'Luis' } },
        { id: 1, type: 'PURCHASE', quantity: 10, resultingStock: 10, movementDate: '2026-10-17T16:00:00Z', recordedBy: { name: 'Ana' } },
      ],
    }))
    await expectWellFormed(zip)
    const sheet = workbook.getWorksheet('Kardex')!
    const header = find(sheet, 'Fecha')
    expect(sheet.getRow(header.row + 1).getCell(4).value).toBe(10)
    expect(sheet.getRow(header.row + 2).getCell(4).value).toBeNull()
    expect(sheet.getRow(header.row + 2).getCell(5).value).toBe(3)
    expect(Object.keys(zip.files).filter((name) => /^xl\/charts\/chart\d+\.xml$/.test(name))).toHaveLength(2)
  })
})
