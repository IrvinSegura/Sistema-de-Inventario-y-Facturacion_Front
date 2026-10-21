import { FileSpreadsheet, Printer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { errorMessage } from '@/api/errors'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { ErrorAlert } from '@/components/ErrorAlert'
import { PrintButton } from '@/components/PrintButton'
import { StatTile } from '@/components/StatTile'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePurchaseReport } from '@/features/purchases/queries'
import { MAX_REPORT_DAYS, useSalesSummary } from '@/features/sales/queries'
import { formatDate } from '@/lib/date-format'
import { type DayRange, lastDaysRange } from '@/lib/days'
import { downloadWorkbook } from '@/lib/excel'
import { formatMoney } from '@/lib/money'
import { useReportMeta } from '@/lib/report-meta'
import { cn } from '@/lib/utils'

import { CashFlowDocument } from './CashFlowDocument'
import { bucketTitle, formatPercent } from './format'
import { centsByDay, defaultGrouping, flowSeries, type FlowPoint, flowTotals, type Grouping } from './periods'
import { FlowChart } from './ReportCharts'
import { ChartPlaceholder, GroupingToggle } from './ReportParts'
import { cashFlowWorkbook } from './reports-excel'

const DEFAULT_RANGE_DAYS = 30

/**
 * Money that came in from sales against what went out to suppliers, per day, week or month. It is
 * cash flow, not profit: purchases buy stock that is sold later.
 */
export function CashFlowReportPage() {
  const { t, i18n } = useTranslation()
  const [range, setRange] = useState<DayRange>(() => lastDaysRange(DEFAULT_RANGE_DAYS))
  const [chosenGrouping, setChosenGrouping] = useState<Grouping | null>(null)
  const [exporting, setExporting] = useState(false)
  const reportMeta = useReportMeta()
  const sales = useSalesSummary(range, null, true)
  const purchases = usePurchaseReport(range, null)
  const grouping = chosenGrouping ?? defaultGrouping(range)

  const series = useMemo(() => sales.data && purchases.data && flowSeries(range, grouping,
    centsByDay(sales.data.byDay ?? [], (day) => day.date, (day) => day.total),
    centsByDay(purchases.data.byDay ?? [], (day) => day.date, (day) => day.total)),
  [sales.data, purchases.data, range, grouping])
  const totals = series && flowTotals(series)
  const error = sales.error ?? purchases.error
  const period = t('reports.periodValue', { from: formatDate(range.from, i18n.language), to: formatDate(range.to, i18n.language) })

  function changeRange(next: DayRange) {
    setRange(next)
    setChosenGrouping(null)
  }

  async function exportExcel() {
    if (!series) {
      return
    }
    setExporting(true)
    try {
      await downloadWorkbook(`${t('excel.files.cashFlow')}_${range.from}_${range.to}`,
        cashFlowWorkbook({ t, language: i18n.language, series, grouping, period }), reportMeta)
    } catch (exportError) {
      toast.error(errorMessage(exportError))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <DateRangeFilter value={range} onChange={changeRange} maxDays={MAX_REPORT_DAYS} />
        <div className="flex flex-wrap gap-2">
          {series ? (
            <PrintButton label={t('reports.print')} document={
              <CashFlowDocument series={series} grouping={grouping} period={period} />
            } />
          ) : (
            <Button variant="outline" disabled><Printer />{t('reports.print')}</Button>
          )}
          <Button variant="outline" disabled={exporting || !series} onClick={() => void exportExcel()}>
            <FileSpreadsheet />
            {exporting ? t('excel.exporting') : t('reports.export')}
          </Button>
        </div>
      </div>

      <p className="-mt-3 text-xs text-muted-foreground">{t('reports.flow.note')}</p>
      {error && <ErrorAlert message={errorMessage(error)} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t('reports.flow.metrics.sales')} value={totals && formatMoney(totals.sales)}
          hint={t('reports.flow.metrics.salesHint')} />
        <StatTile label={t('reports.flow.metrics.purchases')} value={totals && formatMoney(totals.purchases)}
          hint={purchases.data && t('reports.flow.purchaseCount', { count: purchases.data.purchaseCount ?? 0 })} />
        <StatTile label={t('reports.flow.metrics.net')}
          value={totals && <span className={cn(totals.net < 0 && 'text-destructive')}>{totals.net > 0 && '+'}{formatMoney(totals.net)}</span>}
          hint={t('reports.flow.metrics.netHint')} />
        <StatTile label={t('reports.flow.metrics.ratio')}
          value={totals && (totals.sales > 0 ? formatPercent(totals.purchases / totals.sales, i18n.language) : '—')}
          hint={t('reports.flow.metrics.ratioHint')} />
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1.5">
            <CardTitle>{t('reports.flow.chart')}</CardTitle>
            <CardDescription>{t('reports.flow.chartHint')}</CardDescription>
          </div>
          <GroupingToggle value={grouping} onChange={setChosenGrouping} />
        </CardHeader>
        <CardContent>
          {series ? <FlowChart data={series} grouping={grouping} /> : <ChartPlaceholder />}
        </CardContent>
      </Card>

      <FlowTable series={series} grouping={grouping} />
    </div>
  )
}

function FlowTable({ series, grouping }: { series?: FlowPoint[]; grouping: Grouping }) {
  const { t, i18n } = useTranslation()
  const totals = series && flowTotals(series)
  // Newest first, like the other lists.
  const rows = series && [...series].reverse()
  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-4">
        <CardTitle>{t(`reports.flow.by.${grouping}`)}</CardTitle>
      </CardHeader>
      {!rows || !totals ? (
        <CardContent className="pb-6"><div className="h-40 animate-pulse rounded-lg bg-muted/60" /></CardContent>
      ) : (
        <Table stickyHeader>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="pl-4">{t(`reports.grouping.${grouping}`)}</TableHead>
              <TableHead className="text-right">{t('reports.series.sales')}</TableHead>
              <TableHead className="text-right">{t('reports.series.purchases')}</TableHead>
              <TableHead className="text-right">{t('reports.flow.net')}</TableHead>
              <TableHead className="hidden pr-4 text-right sm:table-cell">{t('reports.series.cumulative')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((point) => (
              <TableRow key={point.start}>
                <TableCell className="pl-4 whitespace-nowrap">{bucketTitle(point, grouping, i18n.language)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(point.sales)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(point.purchases)}</TableCell>
                <TableCell className={cn('text-right font-medium tabular-nums', point.net < 0 && 'text-destructive')}>
                  {formatMoney(point.net)}
                </TableCell>
                <TableCell className={cn('hidden pr-4 text-right tabular-nums sm:table-cell', point.cumulative < 0 && 'text-destructive')}>
                  {formatMoney(point.cumulative)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="pl-4">{t('excel.total')}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(totals.sales)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(totals.purchases)}</TableCell>
              <TableCell className={cn('text-right tabular-nums', totals.net < 0 && 'text-destructive')}>{formatMoney(totals.net)}</TableCell>
              <TableCell className="hidden pr-4 sm:table-cell" />
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </Card>
  )
}
