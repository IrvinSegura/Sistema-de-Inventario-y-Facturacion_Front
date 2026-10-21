/**
 * Excel reports built like a small BI workbook: a dashboard sheet (title band, figure cards, summary
 * tables next to native charts) and data sheets with real Excel tables (filters, banded rows that
 * survive sorting, totals that follow the filters). Figures and computed columns are formulas over
 * the data, so editing a cell updates the whole report; conditional formats and data bars react too.
 * exceljs is loaded only when a report is downloaded.
 */

import type { Cell, Fill, Font, Workbook, Worksheet } from 'exceljs'

import { addCharts, type ChartPart, type ChartType } from './excel-charts'

export type ColumnType = 'text' | 'code' | 'money' | 'int' | 'percent' | 'date' | 'datetime'
export type CellValue = string | number | Date | null | undefined
export type Tone = 'brand' | 'danger' | 'warning' | 'success' | 'muted'
export type Row = Record<string, CellValue>

/** Addresses of one row's cells by column key: "E12" for formulas, "$E12" for conditional formats. */
export type RowCells = Record<string, string>
/**
 * Absolute range of a table column's data, e.g. 'Stock'!$E$12:$E$40, from the table's name and
 * the column's key.
 */
export type TableRef = (table: string, column: string) => string

export interface Column {
  key: string
  header: string
  type?: ColumnType
  width?: number
  /**
   * Computed in Excel from the row's other cells or other tables (undefined keeps the row's value);
   * the row's value is the cached result.
   */
  formula?: (cells: RowCells, ref: TableRef, row: Row) => string | undefined
  /** Text color of the data cells. */
  color?: Exclude<Tone, 'brand'>
  /** Totals row: sum, count or average of the visible rows, or a formula over table columns. */
  total?: 'sum' | 'count' | 'average' | { formula: (ref: TableRef) => string; result: CellValue }
  /** Data bar or a red-to-green color scale on the column. */
  visual?: 'bar' | 'scale'
}

export interface Highlight {
  tone: Exclude<Tone, 'brand'>
  /** Condition on the first data row ("$E12<=0"); Excel applies it to every row. */
  when: (cells: RowCells) => string
}

export interface TableSection {
  kind: 'table'
  /** Unique Excel table name (letters, digits and underscores); charts and TableRef find the table by it. */
  name: string
  title?: string
  note?: string
  columns: Column[]
  rows: Row[]
  totalsLabel?: string
  highlights?: Highlight[]
  /** The sheet's main table: its header repeats on every printed page. */
  main?: boolean
}

export interface Kpi {
  label: string
  value: CellValue
  type?: ColumnType
  tone?: Tone
  hint?: string
  /** Formula over table columns; value is its cached result. */
  formula?: (ref: TableRef) => string
}

export interface ChartSpec {
  type: ChartType
  title: string
  /** Data from a table of the workbook (any sheet). */
  table: string
  category: string
  series: { column: string; color?: string }[]
  /** Slice colors of a pie or doughnut, in row order. */
  colors?: string[]
  /** Height in rows. */
  height?: number
}

export type Section =
  | { kind: 'kpis'; title?: string; items: Kpi[] }
  | TableSection
  | { kind: 'chart'; chart: ChartSpec }
  | { kind: 'charts'; charts: [ChartSpec, ChartSpec] }
  // A summary table with its chart to the right.
  | { kind: 'pair'; table: TableSection; chart: ChartSpec }
  | { kind: 'note'; text: string }
  // Links to other sheets.
  | { kind: 'links'; label: string; sheets: string[] }

export interface SheetSpec {
  /** Tab name, adapted to Excel's rules and made unique; links refer to the sheet by this name. */
  name: string
  title: string
  subtitle?: string
  /** Label/value pairs under the title band, such as the filters applied. */
  info?: [string, string][]
  sections: Section[]
  /** Prints in landscape; sheets with figure cards, charts or links always do. */
  landscape?: boolean
}

/** Labels and author every report shares, already translated; useReportMeta builds it. */
export interface ReportMeta {
  storeName: string
  author: string
  generatedLabel: string
  generatedByLabel: string
  pageLabel: string
  emptyLabel: string
  totalLabel: string
  locale: string
}

const COLORS = {
  brand: '1E3A5F',
  brandSoft: 'C9D6E8',
  brandLight: 'EEF3F9',
  accent: '2F80C2',
  border: 'D5DCE6',
  text: '1F2937',
  muted: '6B7280',
  danger: 'B42318',
  dangerFill: 'FDECEA',
  warning: '93610B',
  warningFill: 'FEF3DC',
  success: '1E7B4A',
  successFill: 'E3F4EA',
  white: 'FFFFFF',
}

const TONES: Record<Tone, { color: string; fill: string }> = {
  brand: { color: COLORS.brand, fill: COLORS.brandLight },
  danger: { color: COLORS.danger, fill: COLORS.dangerFill },
  warning: { color: COLORS.warning, fill: COLORS.warningFill },
  success: { color: COLORS.success, fill: COLORS.successFill },
  muted: { color: COLORS.muted, fill: 'F3F4F6' },
}

export const FORMATS: Record<ColumnType, string> = {
  text: 'General',
  code: '@',
  money: '"$"#,##0.00;[Red]-"$"#,##0.00',
  int: '#,##0;[Red]-#,##0',
  percent: '0.0%',
  date: 'dd/mm/yyyy',
  datetime: 'dd/mm/yyyy hh:mm',
}

const DEFAULT_WIDTHS: Record<ColumnType, number> = {
  text: 26, code: 17, money: 15, int: 11, percent: 11, date: 13, datetime: 17,
}

const NUMERIC: ColumnType[] = ['money', 'int', 'percent']
// Columns of a dashboard sheet: cards take two each, charts span several.
const GRID = 10
const GRID_WIDTH = 14
const CHART_HEIGHT = 16

function argb(color: string) {
  return { argb: `FF${color}` }
}

function solid(color: string): Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: argb(color) }
}

function font(extra: Partial<Font> = {}): Partial<Font> {
  return { name: 'Calibri', size: 10, color: argb(COLORS.text), ...extra }
}

const thin = { style: 'thin' as const, color: argb(COLORS.border) }

/**
 * Excel keeps dates without a time zone: write the local wall-clock time as if it were UTC, so the
 * cell shows what the screen shows.
 */
export function excelDate(value: string | Date): Date {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(),
    date.getHours(), date.getMinutes(), date.getSeconds()))
}

/** A calendar day such as "2026-10-19", at midnight UTC so no time zone shifts it to another day. */
export function excelDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date))
}

/** Serial number Excel stores for a date (days since 1899-12-30). */
function serial(date: Date): number {
  return (date.getTime() - Date.UTC(1899, 11, 30)) / 86_400_000
}

/** Letters of a 1-based column number: 1 is "A", 26 is "Z", 27 is "AA". */
export function columnLetter(index: number): string {
  let letter = ''
  for (let n = index; n > 0; n = Math.floor((n - 1) / 26)) {
    letter = String.fromCharCode(65 + ((n - 1) % 26)) + letter
  }
  return letter
}

/**
 * Sheet names: at most 31 characters and none of : \ / ? * [ ]. A name already used (ignoring case)
 * gets a number appended, and the result is added to `used`.
 */
function sheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31).trim() || 'Hoja'
  let unique = base
  for (let n = 2; used.has(unique.toLowerCase()); n++) {
    // 28 leaves room for a space and a two-digit number within the 31-character limit.
    unique = `${base.slice(0, 28)} ${n}`
  }
  used.add(unique.toLowerCase())
  return unique
}

function quoteSheet(name: string) {
  return `'${name.replace(/'/g, "''")}'`
}

/** Structured reference to a table column, escaping the characters Excel reserves in names. */
function structured(table: string, header: string) {
  return `${table}[${header.replace(/(['[\]#])/g, "'$1")}]`
}

function cellValue(value: CellValue) {
  return value === undefined || value === '' ? null : value
}

interface TableInfo {
  sheet: string
  sheetId: number
  section: TableSection
  /** 1-based column of each key; firstRow and lastRow are the data rows. */
  columns: Map<string, number>
  firstRow: number
  lastRow: number
}

interface PendingChart {
  sheetId: number
  spec: ChartSpec
  from: { col: number; row: number }
  to: { col: number; row: number }
}

class ReportBuilder {
  readonly tables = new Map<string, TableInfo>()
  readonly charts: PendingChart[] = []
  readonly pendingFormulas: { cell: Cell; formula: (ref: TableRef) => string | undefined; result: CellValue }[] = []
  readonly links: { cell: Cell; sheet: string }[] = []
  readonly sheetNames = new Map<string, string>()
  private readonly workbook: Workbook
  private readonly meta: ReportMeta

  constructor(workbook: Workbook, meta: ReportMeta) {
    this.workbook = workbook
    this.meta = meta
  }

  ref: TableRef = (table, column) => {
    const info = this.tables.get(table)
    if (!info) {
      throw new Error(`Unknown table ${table}`)
    }
    const letter = columnLetter(info.columns.get(column)!)
    return `${quoteSheet(info.sheet)}!$${letter}$${info.firstRow}:$${letter}$${info.lastRow}`
  }

  /** Writes the formulas and links that point at other sheets, once every sheet is in place. */
  resolve() {
    for (const { cell, formula, result } of this.pendingFormulas) {
      const text = formula(this.ref)
      if (text !== undefined) {
        cell.value = { formula: text, result: cellValue(result) as number | string }
      }
    }
    for (const { cell, sheet } of this.links) {
      const target = this.sheetNames.get(sheet) ?? sheet
      cell.value = { text: `${cell.text} →`, hyperlink: `#${quoteSheet(target)}!A1` }
    }
  }

  chartParts(): ChartPart[] {
    return this.charts.map(({ sheetId, spec, from, to }) => {
      const info = this.tables.get(spec.table)!
      const column = (key: string) => info.section.columns.find((candidate) => candidate.key === key)!
      const categoryColumn = column(spec.category)
      const dated = categoryColumn.type === 'date' || categoryColumn.type === 'datetime'
      const valueType = column(spec.series[0].column).type ?? 'int'
      return {
        sheetId,
        type: spec.type,
        title: spec.title,
        categoriesRef: this.ref(spec.table, spec.category),
        categories: info.section.rows.map((row) => {
          const value = row[spec.category]
          return value instanceof Date ? serial(value) : String(value ?? '')
        }),
        categoryFormat: dated ? 'dd/mm' : undefined,
        valueFormat: valueType === 'money' ? '"$"#,##0' : valueType === 'percent' ? '0%' : '#,##0',
        series: spec.series.map((series) => ({
          name: column(series.column).header,
          ref: this.ref(spec.table, series.column),
          values: info.section.rows.map((row) => typeof row[series.column] === 'number' ? row[series.column] as number : null),
          color: series.color,
        })),
        pointColors: spec.colors,
        from,
        to,
      }
    })
  }

  addSheet(spec: SheetSpec, used: Set<string>) {
    const name = sheetName(spec.name, used)
    this.sheetNames.set(spec.name, name)
    const sheet = this.workbook.addWorksheet(name, { properties: { tabColor: argb(COLORS.brand) } })
    new SheetWriter(this, sheet, name, spec, this.meta).write()
  }
}

class SheetWriter {
  private row = 1
  private readonly widths: number[] = []
  private mainHeaderRow: number | null = null
  private readonly span: number
  private readonly dashboard: boolean
  private readonly report: ReportBuilder
  private readonly sheet: Worksheet
  private readonly name: string
  private readonly spec: SheetSpec
  private readonly meta: ReportMeta

  constructor(report: ReportBuilder, sheet: Worksheet, name: string, spec: SheetSpec, meta: ReportMeta) {
    this.report = report
    this.sheet = sheet
    this.name = name
    this.spec = spec
    this.meta = meta
    const widest = Math.max(0, ...spec.sections.map((section) => section.kind === 'table' ? section.columns.length : 0))
    this.dashboard = spec.sections.some((section) => section.kind !== 'table' && section.kind !== 'note')
    this.span = Math.max(widest, this.dashboard ? GRID : 6)
  }

  write() {
    this.titleBand()
    for (const section of this.spec.sections) {
      switch (section.kind) {
        case 'kpis':
          this.kpis(section.title, section.items)
          break
        case 'table':
          this.table(section, 1)
          break
        case 'chart':
          this.chartBlock([section.chart])
          break
        case 'charts':
          this.chartBlock(section.charts)
          break
        case 'pair':
          this.pair(section.table, section.chart)
          break
        case 'note':
          this.note(section.text)
          break
        case 'links':
          this.linkRow(section.label, section.sheets)
          break
      }
      this.row++
    }
    this.finish()
  }

  private widen(column: number, width: number) {
    this.widths[column] = Math.max(this.widths[column] ?? 0, width)
  }

  private band(row: number, from = 1, to = this.span, color = COLORS.brand) {
    for (let column = from; column <= to; column++) {
      this.sheet.getCell(row, column).fill = solid(color)
    }
  }

  /** Dark band with the store, the report and its period; who and when go on its right. */
  private titleBand() {
    const sheet = this.sheet
    const white = argb(COLORS.white)
    const rightFrom = Math.max(this.span - 2, 3)
    const left = rightFrom - 1

    sheet.getRow(1).height = 8
    this.band(1)
    sheet.mergeCells(2, 1, 2, left)
    const store = sheet.getCell(2, 1)
    store.value = this.meta.storeName.toUpperCase()
    store.font = font({ size: 9, bold: true, color: argb(COLORS.brandSoft) })
    store.alignment = { indent: 1, vertical: 'bottom' }
    sheet.mergeCells(3, 1, 3, left)
    const title = sheet.getCell(3, 1)
    title.value = this.spec.title
    title.font = font({ size: 20, bold: true, color: white })
    title.alignment = { indent: 1, vertical: 'middle' }
    sheet.mergeCells(4, 1, 4, left)
    const subtitle = sheet.getCell(4, 1)
    subtitle.value = this.spec.subtitle ?? ''
    subtitle.font = font({ size: 11, color: argb(COLORS.brandSoft) })
    subtitle.alignment = { indent: 1, vertical: 'top' }

    const generated = new Intl.DateTimeFormat(this.meta.locale, { dateStyle: 'long', timeStyle: 'short' }).format(new Date())
    const stamp: [number, string, Partial<Font>][] = [
      [2, this.meta.generatedLabel.toUpperCase(), font({ size: 8, bold: true, color: argb(COLORS.brandSoft) })],
      [3, generated, font({ size: 10, color: white })],
      [4, `${this.meta.generatedByLabel}: ${this.meta.author}`, font({ size: 9, color: argb(COLORS.brandSoft) })],
    ]
    for (const [row, text, style] of stamp) {
      sheet.mergeCells(row, rightFrom, row, this.span)
      const cell = sheet.getCell(row, rightFrom)
      cell.value = text
      cell.font = style
      cell.alignment = { horizontal: 'right', vertical: row === 2 ? 'bottom' : row === 3 ? 'middle' : 'top', indent: 1 }
    }
    for (let row = 2; row <= 4; row++) {
      this.band(row)
    }
    sheet.getRow(2).height = 18
    sheet.getRow(3).height = 32
    sheet.getRow(4).height = 22
    sheet.getRow(5).height = 5
    this.band(5, 1, this.span, COLORS.accent)
    this.row = 7

    // Filters and other context as label/value chips.
    const info = this.spec.info ?? []
    for (const [label, value] of info) {
      const labelCell = sheet.getCell(this.row, 1)
      labelCell.value = label
      labelCell.font = font({ bold: true, size: 9, color: argb(COLORS.muted) })
      labelCell.alignment = { indent: 1, vertical: 'middle' }
      labelCell.fill = solid(COLORS.brandLight)
      labelCell.border = { left: { style: 'medium', color: argb(COLORS.accent) } }
      sheet.mergeCells(this.row, 2, this.row, Math.min(this.span, 6))
      const valueCell = sheet.getCell(this.row, 2)
      valueCell.value = value
      valueCell.font = font({ bold: true })
      valueCell.alignment = { indent: 1, vertical: 'middle' }
      for (let column = 2; column <= Math.min(this.span, 6); column++) {
        sheet.getCell(this.row, column).fill = solid(COLORS.brandLight)
      }
      sheet.getRow(this.row).height = 17
      this.widen(1, Math.min(label.length + 4, 26))
      this.row++
    }
    if (info.length > 0) {
      this.row++
    }
  }

  private sectionTitle(text: string, from = 1, to = this.span, row = this.row) {
    const cell = this.sheet.getCell(row, from)
    cell.value = text
    cell.font = font({ size: 12, bold: true, color: argb(COLORS.brand) })
    cell.alignment = { vertical: 'bottom' }
    for (let column = from; column <= to; column++) {
      this.sheet.getCell(row, column).border = { bottom: { style: 'medium', color: argb(COLORS.accent) } }
    }
    this.sheet.getRow(row).height = 22
  }

  private note(text: string) {
    this.sheet.mergeCells(this.row, 1, this.row, this.span)
    const cell = this.sheet.getCell(this.row, 1)
    cell.value = text
    cell.font = font({ italic: true, size: 9, color: argb(COLORS.muted) })
    cell.alignment = { wrapText: true, vertical: 'top' }
    // Excel doesn't auto-fit merged cells, so the height is estimated: about 11 characters per column, 14 points per line.
    this.sheet.getRow(this.row).height = Math.max(15, Math.ceil(text.length / (this.span * 11)) * 14)
    this.row++
  }

  private linkRow(label: string, sheets: string[]) {
    const cell = this.sheet.getCell(this.row, 1)
    cell.value = label
    cell.font = font({ size: 9, bold: true, color: argb(COLORS.muted) })
    sheets.forEach((target, index) => {
      const link = this.sheet.getCell(this.row, index * 2 + 2)
      // Text now; the hyperlink once the target's final name is known.
      link.value = target
      link.font = font({ size: 10, bold: true, underline: true, color: argb(COLORS.accent) })
      this.report.links.push({ cell: link, sheet: target })
    })
    this.row++
  }

  /** Figure cards, two grid columns each: a colored edge, the label, the figure and a hint. */
  private kpis(title: string | undefined, items: Kpi[]) {
    if (title) {
      this.sectionTitle(title)
      this.row += 2
    }
    const perRow = Math.max(1, Math.floor(this.span / 2))
    for (let start = 0; start < items.length; start += perRow) {
      const chunk = items.slice(start, start + perRow)
      const [labelRow, valueRow, hintRow] = [this.row, this.row + 1, this.row + 2]
      chunk.forEach((item, index) => {
        const first = index * 2 + 1
        const last = first + 1
        const tone = TONES[item.tone ?? 'brand']
        for (const row of [labelRow, valueRow, hintRow]) {
          this.sheet.mergeCells(row, first, row, last)
          for (let column = first; column <= last; column++) {
            const cell = this.sheet.getCell(row, column)
            cell.fill = solid(tone.fill)
            cell.border = {
              left: column === first ? { style: 'thick', color: argb(tone.color) } : undefined,
              right: column === last ? thin : undefined,
              top: row === labelRow ? thin : undefined,
              bottom: row === hintRow ? thin : undefined,
            }
          }
        }
        const label = this.sheet.getCell(labelRow, first)
        label.value = item.label.toUpperCase()
        label.font = font({ size: 8, bold: true, color: argb(COLORS.muted) })
        label.alignment = { indent: 1, vertical: 'bottom' }
        const value = this.sheet.getCell(valueRow, first)
        value.font = font({ size: 18, bold: true, color: argb(tone.color) })
        value.alignment = { indent: 1, horizontal: 'left', vertical: 'middle' }
        value.numFmt = FORMATS[item.type ?? 'text']
        if (item.formula) {
          value.value = cellValue(item.value)
          this.report.pendingFormulas.push({ cell: value, formula: item.formula, result: item.value })
        } else {
          value.value = cellValue(item.value)
        }
        const hint = this.sheet.getCell(hintRow, first)
        hint.value = item.hint ?? ''
        hint.font = font({ size: 8, color: argb(COLORS.muted) })
        hint.alignment = { indent: 1, vertical: 'top' }
      })
      this.sheet.getRow(labelRow).height = 18
      this.sheet.getRow(valueRow).height = 30
      this.sheet.getRow(hintRow).height = 15
      this.row += 4
    }
    this.row--
  }

  private placeChart(spec: ChartSpec, fromCol: number, toCol: number, fromRow: number, height: number) {
    this.report.charts.push({
      sheetId: this.sheet.id,
      spec,
      from: { col: fromCol - 1, row: fromRow - 1 },
      to: { col: toCol, row: fromRow - 1 + height },
    })
  }

  /** One chart over the full width, or two side by side. */
  private chartBlock(charts: ChartSpec[]) {
    const height = Math.max(...charts.map((chart) => chart.height ?? CHART_HEIGHT))
    const half = Math.floor(this.span / 2)
    charts.forEach((chart, index) => {
      const from = charts.length === 1 ? 1 : index * half + 1
      const to = charts.length === 1 ? this.span : index === 0 ? half : this.span
      this.placeChart(chart, from, to, this.row, height)
    })
    this.row += height
  }

  private pair(table: TableSection, chart: ChartSpec) {
    const start = this.row
    const end = this.table(table, 1)
    const chartFrom = table.columns.length + 2
    const chartTo = Math.max(this.span, chartFrom + 4)
    const height = Math.max(chart.height ?? CHART_HEIGHT, end - start)
    this.placeChart(chart, chartFrom, chartTo, start, height)
    this.row = start + height
  }

  /** Writes a real Excel table; returns the row after it. */
  private table(section: TableSection, startCol: number): number {
    const sheet = this.sheet
    if (section.title) {
      this.sectionTitle(section.title, startCol, startCol + section.columns.length - 1)
      this.row++
    }
    if (section.note) {
      this.note(section.note)
    }
    const { columns } = section
    const headerRow = this.row
    const firstRow = headerRow + 1
    const lastRow = headerRow + Math.max(section.rows.length, 1)
    const columnIndex = new Map(columns.map((column, index) => [column.key, startCol + index]))
    this.report.tables.set(section.name, {
      sheet: this.name, sheetId: sheet.id, section, columns: columnIndex, firstRow, lastRow,
    })
    columns.forEach((column, index) => {
      const type = column.type ?? 'text'
      const longest = Math.max(0, ...section.rows.map((row) => typeof row[column.key] === 'string' ? (row[column.key] as string).length : 0))
      this.widen(startCol + index, Math.max(column.width ?? DEFAULT_WIDTHS[type], Math.min(column.header.length + 5, 40),
        type === 'text' ? Math.min(longest + 3, 48) : 0))
    })

    if (section.rows.length === 0) {
      columns.forEach((column, index) => {
        const cell = sheet.getCell(headerRow, startCol + index)
        cell.value = column.header
        cell.font = font({ bold: true, color: argb(COLORS.white) })
        cell.fill = solid(COLORS.brand)
      })
      sheet.mergeCells(firstRow, startCol, firstRow, startCol + columns.length - 1)
      const empty = sheet.getCell(firstRow, startCol)
      empty.value = this.meta.emptyLabel
      empty.font = font({ italic: true, color: argb(COLORS.muted) })
      empty.alignment = { horizontal: 'center' }
      this.row = firstRow + 1
      return this.row
    }

    const cellsOf = (row: number, absolute: boolean): RowCells => Object.fromEntries(
      columns.map((column) => [column.key, `${absolute ? '$' : ''}${columnLetter(columnIndex.get(column.key)!)}${row}`]))
    const hasTotals = columns.some((column) => column.total)

    sheet.addTable({
      name: section.name,
      ref: `${columnLetter(startCol)}${headerRow}`,
      headerRow: true,
      totalsRow: hasTotals,
      style: { theme: 'TableStyleMedium2', showRowStripes: true },
      columns: columns.map((column, index) => {
        // No column style: exceljs would write it as a dxfId attribute, which Excel's schema
        // doesn't allow on table columns; the cells get their formats below instead.
        const total = column.total
        const values = section.rows.map((row) => row[column.key]).filter((value): value is number => typeof value === 'number')
        const sum = values.reduce((acc, value) => acc + value, 0)
        if (index === 0 && !total) {
          return { name: column.header, totalsRowLabel: section.totalsLabel ?? this.meta.totalLabel, filterButton: true }
        }
        if (total === 'sum') {
          return { name: column.header, totalsRowFunction: 'sum' as const, totalsRowResult: Math.round(sum * 100) / 100, filterButton: true }
        }
        if (total === 'count') {
          return { name: column.header, totalsRowFunction: 'count' as const, totalsRowResult: section.rows.length, filterButton: true }
        }
        if (total === 'average') {
          return { name: column.header, totalsRowFunction: 'average' as const, totalsRowResult: values.length ? sum / values.length : 0, filterButton: true }
        }
        // A custom total is a plain formula in the totals row (written below): exceljs leaves
        // "custom" columns without the formula element Excel requires.
        if (total) {
          return { name: column.header, totalsRowFunction: 'none' as const, filterButton: true }
        }
        return { name: column.header, totalsRowFunction: 'none' as const, filterButton: true }
      }),
      rows: section.rows.map((row) => columns.map((column) => cellValue(row[column.key]))),
    })

    columns.forEach((column) => {
      const total = column.total
      if (total && typeof total === 'object') {
        sheet.getCell(lastRow + 1, columnIndex.get(column.key)!).value = {
          formula: total.formula((table, key) => {
            const info = this.report.tables.get(table)!
            return structured(table, info.section.columns.find((candidate) => candidate.key === key)!.header)
          }),
          result: cellValue(total.result) as number,
        }
      }
    })

    // Number formats and alignment of data and totals.
    columns.forEach((column) => {
      const type = column.type ?? 'text'
      for (let row = firstRow; row <= lastRow + (hasTotals ? 1 : 0); row++) {
        const cell = sheet.getCell(row, columnIndex.get(column.key)!)
        cell.numFmt = FORMATS[type]
        cell.alignment = { horizontal: NUMERIC.includes(type) ? 'right' : 'left', vertical: 'middle' }
      }
    })

    // Computed columns become formulas once every table is placed (they may point at later sheets).
    section.rows.forEach((row, rowIndex) => {
      const cells = cellsOf(firstRow + rowIndex, false)
      columns.forEach((column) => {
        const cell = sheet.getCell(firstRow + rowIndex, columnIndex.get(column.key)!)
        if (column.formula) {
          const formula = column.formula
          this.report.pendingFormulas.push({ cell, formula: (ref) => formula(cells, ref, row), result: row[column.key] })
        }
        if (column.color) {
          cell.font = font({ size: 11, color: argb(TONES[column.color].color) })
        }
      })
    })

    // Heights and readable text; the table style draws header, stripes and totals.
    sheet.getRow(headerRow).height = 22
    for (let row = firstRow; row <= lastRow; row++) {
      sheet.getRow(row).height = 17
    }
    const dataRange = `${columnLetter(startCol)}${firstRow}:${columnLetter(startCol + columns.length - 1)}${lastRow}`
    for (const highlight of section.highlights ?? []) {
      const tone = TONES[highlight.tone]
      sheet.addConditionalFormatting({
        ref: dataRange,
        rules: [{
          type: 'expression',
          priority: 1,
          formulae: [highlight.when(cellsOf(firstRow, true))],
          style: {
            font: { color: argb(tone.color), bold: highlight.tone === 'danger' },
            fill: { type: 'pattern', pattern: 'solid', bgColor: argb(tone.fill) },
          },
        }],
      })
    }
    columns.forEach((column) => {
      const letter = columnLetter(columnIndex.get(column.key)!)
      const ref = `${letter}${firstRow}:${letter}${lastRow}`
      if (column.visual === 'bar') {
        sheet.addConditionalFormatting({
          ref,
          // `as never`: exceljs writes the bar color, but its typings leave `color` out of data-bar rules.
          rules: [{
            type: 'dataBar',
            priority: 2,
            gradient: false,
            minLength: 0,
            maxLength: 100,
            cfvo: [{ type: 'num', value: 0 }, { type: 'max' }],
            color: argb('7FA7D6'),
          } as never],
        })
      } else if (column.visual === 'scale') {
        sheet.addConditionalFormatting({
          ref,
          rules: [{
            type: 'colorScale',
            priority: 2,
            cfvo: [{ type: 'min' }, { type: 'percentile', value: 50 }, { type: 'max' }],
            color: [argb('F8B4B4'), argb('FDF1C7'), argb('B7E4C7')],
          }],
        })
      }
    })

    if (section.main) {
      this.mainHeaderRow = headerRow
    }
    this.row = lastRow + (hasTotals ? 2 : 1)
    return this.row
  }

  private finish() {
    const sheet = this.sheet
    for (let column = 1; column <= this.span; column++) {
      sheet.getColumn(column).width = Math.max(this.widths[column] ?? 0, this.dashboard ? GRID_WIDTH : 12)
    }
    // No frozen panes: the title band and the table header scroll away with the data.
    sheet.views = [{ showGridLines: false, zoomScale: 100 }]
    sheet.pageSetup = {
      orientation: this.spec.landscape || this.dashboard ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 },
      ...(this.mainHeaderRow !== null && { printTitlesRow: `${this.mainHeaderRow}:${this.mainHeaderRow}` }),
    }
    // Footer codes: &L and &R are the left and right parts, &8 an 8-point font; pageLabel holds &P (page) and &N (pages).
    sheet.headerFooter.oddFooter = `&L&8${this.meta.storeName} · ${this.spec.title}&R&8${this.meta.pageLabel}`
  }
}

async function buildWorkbook(sheets: SheetSpec[], meta: ReportMeta) {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = meta.author
  workbook.lastModifiedBy = meta.author
  workbook.company = meta.storeName
  workbook.created = new Date()
  workbook.title = sheets[0]?.title ?? meta.storeName
  // Excel recalculates every formula when the file opens.
  workbook.calcProperties.fullCalcOnLoad = true
  const report = new ReportBuilder(workbook, meta)
  const used = new Set<string>()
  sheets.forEach((spec) => report.addSheet(spec, used))
  report.resolve()
  return { workbook, charts: report.chartParts() }
}

export async function workbookBuffer(sheets: SheetSpec[], meta: ReportMeta): Promise<ArrayBuffer> {
  const [{ workbook, charts }, { default: JSZip }] = await Promise.all([buildWorkbook(sheets, meta), import('jszip')])
  const zip = await JSZip.loadAsync(await workbook.xlsx.writeBuffer())
  await addCharts(zip, charts)
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
}

/** Builds the workbook and saves it as a download; ".xlsx" is appended to the file name when missing. */
export async function downloadWorkbook(fileName: string, sheets: SheetSpec[], meta: ReportMeta) {
  const buffer = await workbookBuffer(sheets, meta)
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`
  link.click()
  // Some browsers start the download after the click returns.
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

