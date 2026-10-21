import { useTranslation } from 'react-i18next'

import { type PrintColumn, PrintDocument, PrintFields, PrintSection, PrintTable } from '@/components/PrintDocument'
import type { SaleReport } from '@/features/sales/queries'
import { formatMoney } from '@/lib/money'

import { bucketTitle, formatChange, formatCount, formatPercent } from './format'
import { change, type ComparisonPoint, type Grouping } from './periods'
import { type Metric, type MethodRow, methodRows, salesMetrics, type SellerRow, sellerRows } from './sales-data'

/**
 * The sales report on paper: the figures against the previous period, sales over time, payment
 * methods, sellers and best sellers.
 */
export function SalesReportDocument({ report, previous, series, grouping, period, previousPeriod, seller, showSellers }: {
  report: SaleReport
  previous?: SaleReport
  series: ComparisonPoint[]
  grouping: Grouping
  period: string
  previousPeriod?: string
  seller: string
  /** A seller's own report leaves the sellers table out: they are its only row. */
  showSellers: boolean
}) {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const compared = previous !== undefined
  const changeCell = (value: number | null | undefined) => value === undefined ? '—' : formatChange(value, language)
  const metricValue = (metric: Metric, value: number) =>
    metric.type === 'money' ? formatMoney(value) : formatCount(value, language)
  // Columns against the previous period, left out when there is none.
  const ifCompared = <T,>(columns: PrintColumn<T>[]) => compared ? columns : []

  const metricColumns: PrintColumn<Metric>[] = [
    { header: t('reports.metric'), cell: (metric) => t(`reports.sales.metrics.${metric.key}`), className: 'font-medium text-slate-900' },
    { header: t('reports.series.current'), numeric: true, className: 'font-semibold', cell: (metric) => metricValue(metric, metric.current) },
    ...ifCompared<Metric>([
      { header: t('reports.series.previous'), numeric: true, cell: (metric) => metricValue(metric, metric.previous ?? 0) },
      { header: t('reports.change.label'), numeric: true, cell: (metric) => changeCell(metric.change) },
    ]),
  ]
  const seriesColumns: PrintColumn<ComparisonPoint>[] = [
    { header: t(`reports.grouping.${grouping}`), cell: (point) => bucketTitle(point, grouping, language) },
    { header: t('reports.series.current'), numeric: true, className: 'font-medium text-slate-900', cell: (point) => formatMoney(point.current) },
    ...ifCompared<ComparisonPoint>([
      { header: t('reports.series.previous'), numeric: true, cell: (point) => formatMoney(point.previous) },
      { header: t('reports.change.label'), numeric: true, cell: (point) => changeCell(change(point.current, point.previous)) },
    ]),
  ]
  const methodColumns: PrintColumn<MethodRow>[] = [
    { header: t('sales.columns.payment'), cell: (row) => t(`checkout.paymentMethods.${row.method}`), className: 'font-medium text-slate-900' },
    { header: t('excel.sales.tickets'), numeric: true, cell: (row) => formatCount(row.tickets, language) },
    { header: t('sales.columns.total'), numeric: true, className: 'font-semibold', cell: (row) => formatMoney(row.total) },
    { header: t('excel.share'), numeric: true, cell: (row) => formatPercent(row.share, language) },
    ...ifCompared<MethodRow>([{ header: t('reports.vsPrevious'), numeric: true, cell: (row) => changeCell(row.change) }]),
  ]
  const sellerColumns: PrintColumn<SellerRow>[] = [
    { header: t('sales.columns.seller'), cell: (row) => row.name, className: 'font-medium text-slate-900' },
    { header: t('excel.sales.tickets'), numeric: true, cell: (row) => formatCount(row.tickets, language) },
    { header: t('sales.columns.total'), numeric: true, className: 'font-semibold', cell: (row) => formatMoney(row.total) },
    { header: t('sales.stats.averageTicket'), numeric: true, cell: (row) => formatMoney(row.average) },
    { header: t('excel.share'), numeric: true, cell: (row) => formatPercent(row.share, language) },
    ...ifCompared<SellerRow>([{ header: t('reports.vsPrevious'), numeric: true, cell: (row) => changeCell(row.change) }]),
  ]
  const products = (report.topProducts ?? []).map((product, index) => ({ ...product, rank: index + 1 }))

  return (
    <PrintDocument kind={t('reports.sales.printKind')} date={period}>
      <PrintFields fields={[
        [t('reports.period'), period],
        [t('reports.comparedWithLabel'), previousPeriod],
        [t('sales.columns.seller'), seller],
      ]} />

      <PrintSection title={t('reports.sales.figures')}>
        <PrintTable rows={salesMetrics(report, previous)} rowKey={(metric) => metric.key} columns={metricColumns} />
      </PrintSection>

      <PrintSection title={t(`reports.sales.chart.${grouping}`)}>
        <PrintTable rows={series} rowKey={(point) => point.start} columns={seriesColumns} />
      </PrintSection>

      <PrintSection title={t('reports.sales.byMethod')}>
        <PrintTable rows={methodRows(report, previous)} rowKey={(row) => row.method} columns={methodColumns} />
      </PrintSection>

      {showSellers && (
        <PrintSection title={t('reports.sales.bySeller')}>
          <PrintTable rows={sellerRows(report, previous)} rowKey={(row) => row.id} columns={sellerColumns} />
        </PrintSection>
      )}

      {products.length > 0 && (
        <PrintSection title={t('reports.sales.topProducts')}>
          <PrintTable rows={products} rowKey={(product) => product.rank} columns={[
            { header: '#', cell: (product) => product.rank },
            { header: t('print.columns.sku'), cell: (product) => product.sku, className: 'font-mono text-[8pt]' },
            { header: t('print.columns.product'), cell: (product) => product.name, className: 'font-medium text-slate-900' },
            { header: t('excel.units'), numeric: true, cell: (product) => formatCount(product.quantity ?? 0, language) },
            { header: t('excel.sales.amountBeforeVat'), numeric: true, className: 'font-semibold', cell: (product) => formatMoney(product.subtotal ?? 0) },
          ]} />
        </PrintSection>
      )}
    </PrintDocument>
  )
}
