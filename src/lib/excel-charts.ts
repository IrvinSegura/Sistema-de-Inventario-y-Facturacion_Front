// Native Excel charts, which exceljs can't write: after exceljs builds the file, the chart parts
// (DrawingML) are added to the zip and linked to their sheets. Every series points at cells of the
// workbook, so editing the data in Excel updates the chart; the cached values let viewers that
// don't recalculate still draw it.

export type ChartType = 'column' | 'bar' | 'line' | 'area' | 'pie' | 'doughnut'

export interface ChartSeries {
  name: string
  // Absolute reference to the values, e.g. 'Resumen'!$C$12:$C$15.
  ref: string
  values: (number | null)[]
  color?: string
}

export interface ChartPart {
  // exceljs worksheet id: its XML is xl/worksheets/sheet{id}.xml.
  sheetId: number
  type: ChartType
  title: string
  categoriesRef: string
  categories: (string | number)[]
  // Format of numeric categories (dates as serial numbers); text categories when absent.
  categoryFormat?: string
  series: ChartSeries[]
  // Slice colors of a pie or doughnut; the palette otherwise.
  pointColors?: string[]
  valueFormat: string
  // Zero-based cell corners of the chart.
  from: { col: number; row: number }
  to: { col: number; row: number }
}

export const CHART_PALETTE = ['1E3A5F', '2F80C2', '1C9A8A', 'E0A030', 'C2412D', '7B61B0', '5B6B82', '58B368']

const NS = {
  c: 'http://schemas.openxmlformats.org/drawingml/2006/chart',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  xdr: 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing',
  rels: 'http://schemas.openxmlformats.org/package/2006/relationships',
}
const DRAWING_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing'
const CHART_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart'
const DRAWING_TYPE = 'application/vnd.openxmlformats-officedocument.drawing+xml'
const CHART_TYPE = 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml'

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function fill(color: string) {
  return `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill>`
}

function textProps(size: number, color: string, bold = false) {
  return `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}" b="${bold ? 1 : 0}">${fill(color)}`
    + '<a:latin typeface="Calibri"/></a:defRPr></a:pPr><a:endParaRPr lang="es-MX"/></a:p></c:txPr>'
}

function title(text: string) {
  return `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1">${fill('1E3A5F')}</a:defRPr></a:pPr>`
    + `<a:r><a:rPr lang="es-MX" sz="1200" b="1">${fill('1E3A5F')}<a:latin typeface="Calibri"/></a:rPr><a:t>${escape(text)}</a:t></a:r>`
    + '</a:p></c:rich></c:tx><c:overlay val="0"/></c:title>'
}

function categories(part: ChartPart) {
  const points = part.categories.map((value, index) =>
    `<c:pt idx="${index}"><c:v>${escape(String(value))}</c:v></c:pt>`).join('')
  const count = `<c:ptCount val="${part.categories.length}"/>`
  return part.categoryFormat
    ? `<c:cat><c:numRef><c:f>${escape(part.categoriesRef)}</c:f><c:numCache><c:formatCode>${escape(part.categoryFormat)}</c:formatCode>${count}${points}</c:numCache></c:numRef></c:cat>`
    : `<c:cat><c:strRef><c:f>${escape(part.categoriesRef)}</c:f><c:strCache>${count}${points}</c:strCache></c:strRef></c:cat>`
}

function values(part: ChartPart, series: ChartSeries) {
  const points = series.values
    .map((value, index) => value === null ? '' : `<c:pt idx="${index}"><c:v>${value}</c:v></c:pt>`).join('')
  return `<c:val><c:numRef><c:f>${escape(series.ref)}</c:f><c:numCache><c:formatCode>${escape(part.valueFormat)}</c:formatCode>`
    + `<c:ptCount val="${series.values.length}"/>${points}</c:numCache></c:numRef></c:val>`
}

function seriesName(series: ChartSeries) {
  return `<c:tx><c:v>${escape(series.name)}</c:v></c:tx>`
}

const AXIS_IDS = '<c:axId val="500100"/><c:axId val="500200"/>'

function axes(part: ChartPart) {
  const horizontal = part.type === 'bar'
  const gridLine = '<c:majorGridlines><c:spPr><a:ln w="6350">' + fill('E5E9F0') + '</a:ln></c:spPr></c:majorGridlines>'
  const noLine = '<c:spPr><a:ln><a:noFill/></a:ln></c:spPr>'
  const axisLine = `<c:spPr><a:ln w="9525">${fill('C8D0DC')}</a:ln></c:spPr>`
  const categoryAxis = '<c:catAx><c:axId val="500100"/><c:scaling><c:orientation val="'
    + (horizontal ? 'maxMin' : 'minMax') + '"/></c:scaling><c:delete val="0"/>'
    + `<c:axPos val="${horizontal ? 'l' : 'b'}"/>`
    + `<c:numFmt formatCode="${escape(part.categoryFormat ?? 'General')}" sourceLinked="0"/>`
    + '<c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>'
    + axisLine + textProps(900, '4B5563')
    + '<c:crossAx val="500200"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/>'
    + '<c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>'
  const valueAxis = '<c:valAx><c:axId val="500200"/><c:scaling><c:orientation val="minMax"/></c:scaling>'
    + `<c:delete val="0"/><c:axPos val="${horizontal ? 'b' : 'l'}"/>${gridLine}`
    + `<c:numFmt formatCode="${escape(part.valueFormat)}" sourceLinked="0"/>`
    + '<c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>'
    + noLine + textProps(900, '6B7280')
    + '<c:crossAx val="500100"/><c:crosses val="'
    + (horizontal ? 'max' : 'autoZero') + '"/><c:crossBetween val="between"/></c:valAx>'
  return categoryAxis + valueAxis
}

function dataLabels(part: ChartPart, round: boolean) {
  if (round) {
    return '<c:dLbls><c:numFmt formatCode="0.0%" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>'
      + textProps(900, 'FFFFFF', true)
      + '<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/>'
      + '<c:showPercent val="1"/><c:showBubbleSize val="0"/><c:showLeaderLines val="1"/></c:dLbls>'
  }
  // Values on bars only when there are few of them; a long axis would be cluttered.
  const show = part.type !== 'line' && part.type !== 'area' && part.categories.length <= 12 && part.series.length === 1
  if (!show) {
    return ''
  }
  return `<c:dLbls><c:numFmt formatCode="${escape(part.valueFormat)}" sourceLinked="0"/>`
    + '<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>' + textProps(800, '374151')
    + '<c:dLblPos val="outEnd"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/>'
    + '<c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>'
}

function plot(part: ChartPart): string {
  const color = (series: ChartSeries, index: number) => series.color ?? CHART_PALETTE[index % CHART_PALETTE.length]
  switch (part.type) {
    case 'pie':
    case 'doughnut': {
      const series = part.series[0]
      // One color per slice, with a white edge between slices.
      const slices = part.categories.map((_, index) =>
        `<c:dPt><c:idx val="${index}"/><c:bubble3D val="0"/><c:spPr>${fill(part.pointColors?.[index] ?? CHART_PALETTE[index % CHART_PALETTE.length])}`
        + `<a:ln w="19050">${fill('FFFFFF')}</a:ln></c:spPr></c:dPt>`).join('')
      const ser = `<c:ser><c:idx val="0"/><c:order val="0"/>${seriesName(series)}${slices}${dataLabels(part, true)}`
        + `${categories(part)}${values(part, series)}</c:ser>`
      return part.type === 'pie'
        ? `<c:pieChart><c:varyColors val="1"/>${ser}<c:firstSliceAng val="0"/></c:pieChart>`
        : `<c:doughnutChart><c:varyColors val="1"/>${ser}<c:firstSliceAng val="0"/><c:holeSize val="58"/></c:doughnutChart>`
    }
    case 'line':
    case 'area': {
      const area = part.type === 'area'
      const ser = part.series.map((series, index) => {
        const tone = color(series, index)
        const shape = area
          ? `<c:spPr>${fill(tone)}<a:ln w="22225">${fill(tone)}</a:ln></c:spPr>`
          : `<c:spPr><a:ln w="28575" cap="rnd">${fill(tone)}<a:round/></a:ln></c:spPr>`
        const marker = area ? '' : part.categories.length <= 40
          ? `<c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr>${fill('FFFFFF')}<a:ln w="15875">${fill(tone)}</a:ln></c:spPr></c:marker>`
          : '<c:marker><c:symbol val="none"/></c:marker>'
        return `<c:ser><c:idx val="${index}"/><c:order val="${index}"/>${seriesName(series)}${shape}${marker}`
          + `${categories(part)}${values(part, series)}${area ? '' : '<c:smooth val="0"/>'}</c:ser>`
      }).join('')
      return area
        ? `<c:areaChart><c:grouping val="standard"/><c:varyColors val="0"/>${ser}${AXIS_IDS}</c:areaChart>`
        : `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${ser}<c:marker val="1"/>${AXIS_IDS}</c:lineChart>`
    }
    default: {
      const ser = part.series.map((series, index) =>
        `<c:ser><c:idx val="${index}"/><c:order val="${index}"/>${seriesName(series)}<c:spPr>${fill(color(series, index))}</c:spPr>`
        + `<c:invertIfNegative val="0"/>${dataLabels(part, false)}${categories(part)}${values(part, series)}</c:ser>`).join('')
      return `<c:barChart><c:barDir val="${part.type === 'bar' ? 'bar' : 'col'}"/><c:grouping val="clustered"/>`
        + `<c:varyColors val="0"/>${ser}<c:gapWidth val="55"/>${part.series.length > 1 ? '<c:overlap val="-10"/>' : ''}`
        + `${AXIS_IDS}</c:barChart>`
    }
  }
}

export function chartXml(part: ChartPart): string {
  const round = part.type === 'pie' || part.type === 'doughnut'
  const legend = round || part.series.length > 1
    ? `<c:legend><c:legendPos val="${round ? 'r' : 'b'}"/><c:overlay val="0"/>${textProps(900, '374151')}</c:legend>`
    : ''
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + `<c:chartSpace xmlns:c="${NS.c}" xmlns:a="${NS.a}" xmlns:r="${NS.r}">`
    + '<c:roundedCorners val="0"/>'
    + `<c:chart>${title(part.title)}<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${plot(part)}`
    + `${round ? '' : axes(part)}<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea>${legend}`
    + '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>'
    + `<c:spPr>${fill('FFFFFF')}<a:ln w="9525">${fill('D5DCE6')}</a:ln></c:spPr>`
    + textProps(1000, '374151')
    + '</c:chartSpace>'
}

function drawingXml(anchors: { part: ChartPart; relId: string; id: number }[]): string {
  const frames = anchors.map(({ part, relId, id }) =>
    '<xdr:twoCellAnchor editAs="oneCell">'
    + `<xdr:from><xdr:col>${part.from.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${part.from.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>`
    + `<xdr:to><xdr:col>${part.to.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${part.to.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>`
    + `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${id + 1}" name="${escape(part.title)}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>`
    + '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>'
    + `<a:graphic><a:graphicData uri="${NS.c}"><c:chart xmlns:c="${NS.c}" xmlns:r="${NS.r}" r:id="${relId}"/></a:graphicData></a:graphic>`
    + '</xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>').join('')
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + `<xdr:wsDr xmlns:xdr="${NS.xdr}" xmlns:a="${NS.a}">${frames}</xdr:wsDr>`
}

function relsXml(rels: { id: string; type: string; target: string }[]): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + `<Relationships xmlns="${NS.rels}">`
    + rels.map((rel) => `<Relationship Id="${rel.id}" Type="${rel.type}" Target="${rel.target}"/>`).join('')
    + '</Relationships>'
}

// Where <drawing> goes in a worksheet (CT_Worksheet order): right after the page footer, or before
// the table parts. Nested <extLst> elements (inside conditional formats) must not be mistaken for
// the sheet's own.
function drawingPosition(sheetXml: string): number {
  const footer = sheetXml.indexOf('</headerFooter>')
  if (footer >= 0) {
    return footer + '</headerFooter>'.length
  }
  const tables = sheetXml.indexOf('<tableParts')
  return tables >= 0 ? tables : sheetXml.lastIndexOf('</worksheet>')
}

// exceljs writes links to other sheets as external ones ("#'Sheet'!A1" with a relationship);
// Excel's in-document form is a location alone.
function internalLinks(sheetXml: string, relsXml: string) {
  const internal = new Set<string>()
  const rels = relsXml.replace(/<Relationship Id="(rId\d+)" Type="[^"]+\/hyperlink" Target="#[^"]*" TargetMode="External"\/>/g,
    (_, id: string) => {
      internal.add(id)
      return ''
    })
  const sheet = sheetXml.replace(/<hyperlink ref="([^"]+)" r:id="(rId\d+)" location="#([^"]*)"\/>/g,
    (match, ref: string, id: string, location: string) => internal.has(id) ? `<hyperlink ref="${ref}" location="${location}"/>` : match)
  return { sheet, rels }
}

interface Zip {
  file(path: string): { async(type: 'string'): Promise<string> } | null
  file(path: string, data: string): unknown
}

interface ZipEntries {
  files: Record<string, unknown>
}

// Finishes an xlsx built by exceljs: adds the charts, turns links to other sheets into internal ones
// and gives the theme the report colors, which the tables' built-in style (TableStyleMedium2,
// accent 1) uses.
export async function addCharts(zip: Zip & ZipEntries, parts: ChartPart[]) {
  for (const path of Object.keys(zip.files).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))) {
    const relsPath = path.replace('worksheets/', 'worksheets/_rels/').replace(/\.xml$/, '.xml.rels')
    const relsFile = zip.file(relsPath)
    if (!relsFile) {
      continue
    }
    const fixed = internalLinks(await zip.file(path)!.async('string'), await relsFile.async('string'))
    zip.file(path, fixed.sheet)
    zip.file(relsPath, fixed.rels)
  }

  const theme = zip.file('xl/theme/theme1.xml')
  if (theme) {
    let xml = await theme.async('string')
    CHART_PALETTE.slice(0, 6).forEach((color, index) => {
      xml = xml.replace(new RegExp(`<a:accent${index + 1}>\\s*<a:(srgbClr|sysClr)[^>]*/>\\s*</a:accent${index + 1}>`),
        `<a:accent${index + 1}><a:srgbClr val="${color}"/></a:accent${index + 1}>`)
    })
    zip.file('xl/theme/theme1.xml', xml)
  }
  if (parts.length === 0) {
    return
  }

  const contentTypesFile = zip.file('[Content_Types].xml')!
  let contentTypes = await contentTypesFile.async('string')
  const overrides: string[] = []
  const bySheet = new Map<number, ChartPart[]>()
  parts.forEach((part) => bySheet.set(part.sheetId, [...(bySheet.get(part.sheetId) ?? []), part]))

  let chartNumber = 0
  let drawingNumber = 0
  for (const [sheetId, sheetParts] of bySheet) {
    drawingNumber++
    const anchors = sheetParts.map((part, index) => {
      chartNumber++
      zip.file(`xl/charts/chart${chartNumber}.xml`, chartXml(part))
      overrides.push(`<Override PartName="/xl/charts/chart${chartNumber}.xml" ContentType="${CHART_TYPE}"/>`)
      return { part, relId: `rId${index + 1}`, id: index + 1, target: `../charts/chart${chartNumber}.xml` }
    })
    zip.file(`xl/drawings/drawing${drawingNumber}.xml`, drawingXml(anchors))
    zip.file(`xl/drawings/_rels/drawing${drawingNumber}.xml.rels`,
      relsXml(anchors.map((anchor) => ({ id: anchor.relId, type: CHART_REL, target: anchor.target }))))
    overrides.push(`<Override PartName="/xl/drawings/drawing${drawingNumber}.xml" ContentType="${DRAWING_TYPE}"/>`)

    // Link the drawing from the sheet, next to the relationships exceljs already wrote.
    const relsPath = `xl/worksheets/_rels/sheet${sheetId}.xml.rels`
    const existing = zip.file(relsPath)
    const relsText = existing ? await existing.async('string') : relsXml([])
    const used = [...relsText.matchAll(/Id="rId(\d+)"/g)].map((match) => Number(match[1]))
    const drawingRel = `rId${Math.max(0, ...used) + 1}`
    zip.file(relsPath, relsText.replace('</Relationships>',
      `<Relationship Id="${drawingRel}" Type="${DRAWING_REL}" Target="../drawings/drawing${drawingNumber}.xml"/></Relationships>`))

    const sheetPath = `xl/worksheets/sheet${sheetId}.xml`
    let sheetXml = await zip.file(sheetPath)!.async('string')
    const at = drawingPosition(sheetXml)
    sheetXml = `${sheetXml.slice(0, at)}<drawing r:id="${drawingRel}"/>${sheetXml.slice(at)}`
    zip.file(sheetPath, sheetXml)
  }
  contentTypes = contentTypes.replace('</Types>', `${overrides.join('')}</Types>`)
  zip.file('[Content_Types].xml', contentTypes)
}
