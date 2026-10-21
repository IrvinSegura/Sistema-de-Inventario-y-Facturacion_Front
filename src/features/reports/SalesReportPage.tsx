import { FileSpreadsheet, PackageSearch, Printer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { errorMessage } from '@/api/errors'
import { managesStore, useUser } from '@/auth/auth-context'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { EmptyState } from '@/components/EmptyState'
import { ErrorAlert } from '@/components/ErrorAlert'
import { PrintButton } from '@/components/PrintButton'
import { StatTile } from '@/components/StatTile'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MAX_REPORT_DAYS, type SaleReport, useSalesSummary } from '@/features/sales/queries'
import { useSellerOptions } from '@/features/sales/use-seller-options'
import { formatDate } from '@/lib/date-format'
import { type DayRange, daysInRange, FIRST_DAY, lastDaysRange } from '@/lib/days'
import { downloadWorkbook } from '@/lib/excel'
import { formatMoney } from '@/lib/money'
import { useReportMeta } from '@/lib/report-meta'
import { cn } from '@/lib/utils'

import { formatCount, formatPercent } from './format'
import { centsByDay, comparisonSeries, defaultGrouping, type Grouping, previousRange } from './periods'
import { ComparisonChart } from './ReportCharts'
import { ChangeBadge, ChartPlaceholder, GroupingToggle, ShareBar } from './ReportParts'
import { salesReportWorkbook } from './reports-excel'
import { type Metric, type MetricKey, methodRows, salesMetrics, sellerRows } from './sales-data'
import { SalesReportDocument } from './SalesReportDocument'

const DEFAULT_RANGE_DAYS = 30
const ALL = 'all'

/**
 * Sales of a period against the period of the same length right before it: figures, sales over
 * time, payment methods, sellers and best sellers; printable and as an Excel workbook. Sellers get
 * their own sales (the API scopes them) without the seller filter or costs.
 */
export function SalesReportPage() {
  const { t, i18n } = useTranslation()
  const user = useUser()
  const isManager = managesStore(user.role)
  const [range, setRange] = useState<DayRange>(() => lastDaysRange(DEFAULT_RANGE_DAYS))
  const [sellerId, setSellerId] = useState<number | null>(null)
  // Null follows the period's length.
  const [chosenGrouping, setChosenGrouping] = useState<Grouping | null>(null)
  const [exporting, setExporting] = useState(false)
  const reportMeta = useReportMeta()

  const previous = useMemo(() => previousRange(range), [range])
  // The API has nothing before FIRST_DAY to compare with.
  const comparable = previous.from >= FIRST_DAY
  const current = useSalesSummary(range, sellerId, true)
  const before = useSalesSummary(previous, sellerId, comparable)
  const sellers = useSellerOptions(range, isManager)
  const grouping = chosenGrouping ?? defaultGrouping(range)

  const report = current.data
  const previousReport = comparable ? before.data : undefined
  // Everything waits for both periods, so changes never show against a missing comparison.
  const ready = report && (!comparable || previousReport) ? report : undefined
  const series = useMemo(() => ready && comparisonSeries(range, grouping,
    centsByDay(ready.byDay ?? [], (day) => day.date, (day) => day.total),
    centsByDay(previousReport?.byDay ?? [], (day) => day.date, (day) => day.total)),
  [ready, previousReport, range, grouping])
  const metrics = ready && salesMetrics(ready, previousReport)
  const error = current.error ?? before.error

  const seller = sellers.find((option) => option.id === sellerId)
  const period = t('reports.periodValue', { from: formatDate(range.from, i18n.language), to: formatDate(range.to, i18n.language) })
  const previousPeriod = comparable
    ? t('reports.periodValue', { from: formatDate(previous.from, i18n.language), to: formatDate(previous.to, i18n.language) })
    : undefined
  const sellerLabel = isManager ? seller?.name ?? t('sales.filters.allSellers') : user.name

  function changeRange(next: DayRange) {
    setRange(next)
    setChosenGrouping(null)
  }

  async function exportExcel() {
    if (!ready || !series) {
      return
    }
    setExporting(true)
    try {
      await downloadWorkbook(`${t('excel.files.salesReport')}_${range.from}_${range.to}`,
        salesReportWorkbook({ t, language: i18n.language, report: ready, previous: previousReport, series, grouping,
          period, previousPeriod, seller: sellerLabel, showSellers: isManager }), reportMeta)
    } catch (exportError) {
      toast.error(errorMessage(exportError))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <DateRangeFilter value={range} onChange={changeRange} maxDays={MAX_REPORT_DAYS} />
          {isManager && (
            <div className="grid gap-2">
              <Label htmlFor="report-seller">{t('sales.columns.seller')}</Label>
              <Select id="report-seller" className="h-9 w-52" value={sellerId === null ? ALL : String(sellerId)}
                onValueChange={(value) => setSellerId(!value || value === ALL ? null : Number(value))}
                options={[
                  { value: ALL, label: t('sales.filters.allSellers') },
                  ...sellers.map((option) => ({ value: String(option.id), label: option.name })),
                ]} />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {ready && series ? (
            <PrintButton label={t('reports.print')} document={
              <SalesReportDocument report={ready} previous={previousReport} series={series} grouping={grouping}
                period={period} previousPeriod={previousPeriod} seller={sellerLabel} showSellers={isManager} />
            } />
          ) : (
            <Button variant="outline" disabled><Printer />{t('reports.print')}</Button>
          )}
          <Button variant="outline" disabled={exporting || !ready} onClick={() => void exportExcel()}>
            <FileSpreadsheet />
            {exporting ? t('excel.exporting') : t('reports.export')}
          </Button>
        </div>
      </div>

      {previousPeriod && <p className="-mt-3 text-xs text-muted-foreground">{t('reports.comparedWith', { period: previousPeriod })}</p>}
      {error && <ErrorAlert message={errorMessage(error)} />}

      <MetricTiles metrics={metrics} profit={ready?.profit} subtotal={ready?.completed?.subtotal ?? 0} isManager={isManager} />

      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1.5">
            <CardTitle>{t(`reports.sales.chart.${grouping}`)}</CardTitle>
            <CardDescription>{t('reports.sales.chartHint')}</CardDescription>
          </div>
          <GroupingToggle value={grouping} onChange={setChosenGrouping} />
        </CardHeader>
        <CardContent>
          {series ? (
            <ComparisonChart data={series} grouping={grouping} previousShift={-daysInRange(range)} />
          ) : (
            <ChartPlaceholder />
          )}
        </CardContent>
      </Card>

      {/* A seller's report has only them in it. */}
      <div className={cn('grid gap-6', isManager && 'xl:grid-cols-2')}>
        <MethodsCard report={ready} previous={previousReport} />
        {isManager && <SellersCard report={ready} previous={previousReport} />}
      </div>

      <TopProductsCard report={ready} />
    </div>
  )
}

function MetricTiles({ metrics, profit, subtotal, isManager }: {
  metrics?: Metric[]
  profit?: SaleReport['profit']
  /** Completed sales before VAT, to say how much of them the profit covers. */
  subtotal: number
  isManager: boolean
}) {
  const { t, i18n } = useTranslation()
  const shown: MetricKey[] = isManager
    ? ['sales', 'tickets', 'averageTicket', 'grossProfit', 'cancelled']
    : ['sales', 'tickets', 'averageTicket', 'cancelled']
  // Profit only counts sales with a recorded cost; their share is shown when some sales lack one.
  const coverage = profit && subtotal > 0 ? (profit.costedSubtotal ?? 0) / subtotal : undefined
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2', isManager ? 'lg:grid-cols-3 xl:grid-cols-5' : 'lg:grid-cols-4')}>
      {shown.map((key) => {
        const metric = metrics?.find((item) => item.key === key)
        const format = (value: number) => metric?.type === 'money' ? formatMoney(value) : formatCount(value, i18n.language)
        return (
          <StatTile key={key} label={t(`reports.sales.metrics.${key}`)} value={metric && format(metric.current)}
            hint={metric && (
              <span className="grid gap-0.5">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <ChangeBadge value={metric.change} inverse={metric.inverse} />
                  {metric.previous !== undefined && t('reports.previousValue', { value: format(metric.previous) })}
                </span>
                {key === 'grossProfit' && profit && (
                  <span>
                    {profit.margin !== undefined && profit.margin !== null
                      ? t('reports.sales.margin', { margin: formatPercent(profit.margin, i18n.language) })
                      : t('reports.sales.noCost')}
                    {coverage !== undefined && coverage < 1 && ` · ${t('reports.sales.coverage', { share: formatPercent(coverage, i18n.language) })}`}
                  </span>
                )}
              </span>
            )} />
        )
      })}
    </div>
  )
}

function TableCardSkeleton() {
  return <div className="h-40 animate-pulse rounded-lg bg-muted/60" />
}

function MethodsCard({ report, previous }: { report?: SaleReport; previous?: SaleReport }) {
  const { t, i18n } = useTranslation()
  const rows = report && methodRows(report, previous)
  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-4">
        <CardTitle>{t('reports.sales.byMethod')}</CardTitle>
        <CardDescription>{t('reports.sales.byMethodHint')}</CardDescription>
      </CardHeader>
      {!rows ? (
        <CardContent className="pb-6"><TableCardSkeleton /></CardContent>
      ) : rows.length === 0 ? (
        <p className="px-4 pb-10 text-center text-sm text-muted-foreground">{t('dashboard.noSales')}</p>
      ) : (
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="pl-4">{t('sales.columns.payment')}</TableHead>
              <TableHead className="text-right">{t('excel.sales.tickets')}</TableHead>
              <TableHead className="text-right">{t('sales.columns.total')}</TableHead>
              <TableHead className="w-32">{t('excel.share')}</TableHead>
              <TableHead className="pr-4 text-right">{t('reports.vsPrevious')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.method}>
                <TableCell className="pl-4 font-medium">{t(`checkout.paymentMethods.${row.method}`)}</TableCell>
                <TableCell className="text-right tabular-nums">{row.tickets}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatMoney(row.total)}</TableCell>
                <TableCell>
                  <div className="grid gap-1">
                    <span className="text-xs text-muted-foreground tabular-nums">{formatPercent(row.share, i18n.language)}</span>
                    <ShareBar value={row.share} />
                  </div>
                </TableCell>
                <TableCell className="pr-4 text-right"><ChangeBadge value={row.change} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  )
}

function SellersCard({ report, previous }: { report?: SaleReport; previous?: SaleReport }) {
  const { t, i18n } = useTranslation()
  const rows = report && sellerRows(report, previous)
  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-4">
        <CardTitle>{t('reports.sales.bySeller')}</CardTitle>
        <CardDescription>{t('reports.sales.bySellerHint')}</CardDescription>
      </CardHeader>
      {!rows ? (
        <CardContent className="pb-6"><TableCardSkeleton /></CardContent>
      ) : rows.length === 0 ? (
        <p className="px-4 pb-10 text-center text-sm text-muted-foreground">{t('dashboard.noSales')}</p>
      ) : (
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="pl-4">{t('sales.columns.seller')}</TableHead>
              <TableHead className="text-right">{t('excel.sales.tickets')}</TableHead>
              <TableHead className="text-right">{t('sales.columns.total')}</TableHead>
              <TableHead className="hidden text-right sm:table-cell">{t('sales.stats.averageTicket')}</TableHead>
              <TableHead className="hidden w-28 md:table-cell">{t('excel.share')}</TableHead>
              <TableHead className="pr-4 text-right">{t('reports.vsPrevious')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="max-w-44 truncate pl-4 font-medium">{row.name}</TableCell>
                <TableCell className="text-right tabular-nums">{row.tickets}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatMoney(row.total)}</TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatMoney(row.average)}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="grid gap-1">
                    <span className="text-xs text-muted-foreground tabular-nums">{formatPercent(row.share, i18n.language)}</span>
                    <ShareBar value={row.share} />
                  </div>
                </TableCell>
                <TableCell className="pr-4 text-right"><ChangeBadge value={row.change} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  )
}

function TopProductsCard({ report }: { report?: SaleReport }) {
  const { t, i18n } = useTranslation()
  const products = report?.topProducts
  const subtotal = report?.completed?.subtotal ?? 0
  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-4">
        <CardTitle>{t('reports.sales.topProducts')}</CardTitle>
        <CardDescription>{t('reports.sales.topProductsHint')}</CardDescription>
      </CardHeader>
      {!products ? (
        <CardContent className="pb-6"><TableCardSkeleton /></CardContent>
      ) : products.length === 0 ? (
        <EmptyState icon={PackageSearch} text={t('dashboard.noSales')} />
      ) : (
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-12 pl-4">#</TableHead>
              <TableHead>{t('sales.detail.product')}</TableHead>
              <TableHead className="hidden sm:table-cell">{t('inventory.columns.sku')}</TableHead>
              <TableHead className="text-right">{t('excel.units')}</TableHead>
              <TableHead className="text-right">{t('excel.sales.amountBeforeVat')}</TableHead>
              <TableHead className="hidden w-32 pr-4 md:table-cell">{t('reports.sales.ofSales')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product, index) => {
              const share = subtotal > 0 ? (product.subtotal ?? 0) / subtotal : 0
              return (
                <TableRow key={product.productId ?? index}>
                  <TableCell className="pl-4 text-muted-foreground tabular-nums">{index + 1}</TableCell>
                  <TableCell className="max-w-64 truncate font-medium">{product.name}</TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">{product.sku}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(product.quantity ?? 0, i18n.language)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatMoney(product.subtotal ?? 0)}</TableCell>
                  <TableCell className="hidden pr-4 md:table-cell">
                    <div className="grid gap-1">
                      <span className="text-xs text-muted-foreground tabular-nums">{formatPercent(share, i18n.language)}</span>
                      <ShareBar value={share} />
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  )
}
