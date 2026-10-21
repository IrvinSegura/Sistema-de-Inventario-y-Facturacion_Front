import { useTranslation } from 'react-i18next'

import { PrintDocument, PrintFields, PrintSection, PrintTable, PrintTotals } from '@/components/PrintDocument'
import { formatMoney } from '@/lib/money'

import { bucketTitle, formatPercent } from './format'
import { type FlowPoint, flowTotals, type Grouping } from './periods'

/** Money in and out on paper, per day, week or month, with the period's totals. */
export function CashFlowDocument({ series, grouping, period }: {
  series: FlowPoint[]
  grouping: Grouping
  period: string
}) {
  const { t, i18n } = useTranslation()
  const totals = flowTotals(series)
  const negative = (value: number) => value < 0 ? 'text-red-700' : undefined

  return (
    <PrintDocument kind={t('reports.flow.printKind')} date={period}>
      <PrintFields fields={[
        [t('reports.period'), period],
        [t('reports.grouping.label'), t(`reports.grouping.${grouping}`)],
        [t('reports.flow.metrics.ratio'), totals.sales > 0 ? formatPercent(totals.purchases / totals.sales, i18n.language) : '—'],
      ]} />

      <PrintSection title={t(`reports.flow.by.${grouping}`)}>
        <PrintTable rows={series} rowKey={(point) => point.start} columns={[
          { header: t(`reports.grouping.${grouping}`), cell: (point) => bucketTitle(point, grouping, i18n.language), className: 'text-slate-900' },
          { header: t('reports.series.sales'), numeric: true, cell: (point) => formatMoney(point.sales) },
          { header: t('reports.series.purchases'), numeric: true, cell: (point) => formatMoney(point.purchases) },
          { header: t('reports.flow.net'), numeric: true, className: 'font-semibold',
            cell: (point) => <span className={negative(point.net)}>{formatMoney(point.net)}</span> },
          { header: t('reports.series.cumulative'), numeric: true,
            cell: (point) => <span className={negative(point.cumulative)}>{formatMoney(point.cumulative)}</span> },
        ]} />
        <PrintTotals aside={t('reports.flow.note')} rows={[
          { label: t('reports.flow.metrics.sales'), value: formatMoney(totals.sales) },
          { label: t('reports.flow.metrics.purchases'), value: `−${formatMoney(totals.purchases)}` },
          { label: t('reports.flow.metrics.net'), value: formatMoney(totals.net), grand: true },
        ]} />
      </PrintSection>
    </PrintDocument>
  )
}
