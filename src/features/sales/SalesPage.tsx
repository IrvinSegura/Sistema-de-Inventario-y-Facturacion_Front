import { Ban, Eye, FileSpreadsheet, Receipt } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { errorMessage } from '@/api/errors'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { EmptyState } from '@/components/EmptyState'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Pagination } from '@/components/Pagination'
import { SearchInput } from '@/components/SearchInput'
import { SortableHead } from '@/components/SortableHead'
import { StatTile } from '@/components/StatTile'
import { TableSkeleton } from '@/components/TableSkeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CancelSaleDialog } from '@/features/cash-drawer/DrawerSales'
import { formatDate } from '@/features/cash-drawer/format'
import { daysInRange, lastDaysRange } from '@/features/dashboard/days'
import { dateLocale } from '@/i18n'
import { downloadWorkbook } from '@/lib/excel'
import { formatMoney } from '@/lib/money'
import { useReportMeta } from '@/lib/report-meta'
import { type SortState } from '@/lib/sort'
import { NOT_DIGIT } from '@/lib/text-rules'
import { usePageSize } from '@/lib/use-page-size'
import { cn } from '@/lib/utils'

import { type CustomerRef, CustomerFilter } from './CustomerFilter'
import {
  fetchAllSales,
  fetchSalesReport,
  MAX_EXPORT_ROWS,
  MAX_REPORT_DAYS,
  type SaleFilters,
  type SaleReport,
  type SaleStatus,
  type SaleSummary,
  useSales,
  useSalesSummary,
} from './queries'
import { SaleDetailDialog } from './SaleDetailDialog'
import { salesWorkbook } from './sales-report'
import { useSellerOptions } from './use-seller-options'

// Waits for a pause in typing before searching, so each keystroke isn't a request.
const SEARCH_DELAY_MS = 300
const DEFAULT_RANGE_DAYS = 7
const ALL = 'all'
const statuses: SaleStatus[] = ['COMPLETED', 'CANCELLED']

// Every sale of the store (admins and supervisors): the period's totals, filters by ticket, seller,
// customer and status, and each ticket to see, reprint or cancel.
export function SalesPage() {
  const { t, i18n } = useTranslation()
  const [filters, setFilters] = useState<SaleFilters>(() => ({
    range: lastDaysRange(DEFAULT_RANGE_DAYS), saleNumber: null, sellerId: null, customerId: null, status: null,
  }))
  const [numberText, setNumberText] = useState('')
  const [customer, setCustomer] = useState<CustomerRef | null>(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = usePageSize('sales')
  // Column order; null keeps the list's default.
  const [sort, setSort] = useState<SortState | null>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  const [cancelling, setCancelling] = useState<SaleSummary | null>(null)
  const [exporting, setExporting] = useState(false)
  const sales = useSales(filters, page, pageSize, sort)
  const changeSort = (next: SortState | null) => {
    setSort(next)
    setPage(0)
  }
  const reportable = daysInRange(filters.range) <= MAX_REPORT_DAYS
  const summary = useSalesSummary(filters.range, filters.sellerId, reportable)
  const sellers = useSellerOptions(filters.range, reportable)
  const when = new Intl.DateTimeFormat(dateLocale(i18n.language), { dateStyle: 'medium', timeStyle: 'short' })
  const reportMeta = useReportMeta()
  const byNumber = filters.saleNumber !== null

  const changeFilters = (change: Partial<SaleFilters>) => {
    setFilters((current) => ({ ...current, ...change }))
    setPage(0)
  }

  useEffect(() => {
    const saleNumber = numberText === '' ? null : Number(numberText)
    if (saleNumber === filters.saleNumber) {
      return
    }
    const timer = window.setTimeout(() => {
      setFilters((current) => ({ ...current, saleNumber }))
      setPage(0)
    }, SEARCH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [numberText, filters.saleNumber])

  async function exportExcel() {
    setExporting(true)
    try {
      const [{ sales: all, truncated }, report] = await Promise.all([
        fetchAllSales(filters, sort),
        reportable && !byNumber ? fetchSalesReport(filters.range, filters.sellerId) : Promise.resolve(undefined),
      ])
      if (truncated) {
        toast.warning(t('sales.exportTruncated', { count: MAX_EXPORT_ROWS }))
      }
      const seller = sellers.find((option) => option.id === filters.sellerId)
      const info: [string, string][] = [
        [t('sales.columns.seller'), seller?.name ?? t('sales.filters.allSellers')],
        [t('sales.columns.customer'), customer?.name ?? t('excel.anyCustomer')],
        [t('sales.columns.status'), filters.status ? t(`sales.status.${filters.status}`) : t('sales.filters.allStatuses')],
        ...(byNumber ? [[t('sales.filters.number'), `#${filters.saleNumber}`] as [string, string]] : []),
      ]
      const period = byNumber
        ? t('excel.allDates')
        : t('excel.period', { from: formatDate(filters.range.from, i18n.language), to: formatDate(filters.range.to, i18n.language) })
      await downloadWorkbook(`${t('excel.files.sales')}_${filters.range.from}_${filters.range.to}`,
        salesWorkbook({
          t, sales: all, truncated, report, period, info,
          live: !!report && !truncated && !byNumber && !filters.customerId && !filters.status,
        }), reportMeta)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setExporting(false)
    }
  }

  const rows = sales.data?.content ?? []

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t('sales.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('sales.description')}</p>
        </div>
        <Button variant="outline" disabled={exporting || rows.length === 0} onClick={() => void exportExcel()}>
          <FileSpreadsheet />
          {exporting ? t('sales.exporting') : t('sales.export')}
        </Button>
      </div>

      <DateRangeFilter value={filters.range} disabled={byNumber} onChange={(range) => changeFilters({ range })} />

      {reportable ? (
        <SummaryTiles report={summary.data} />
      ) : (
        <p className="text-sm text-muted-foreground">{t('sales.summaryTooLong', { count: MAX_REPORT_DAYS })}</p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <Label htmlFor="sales-number">{t('sales.filters.number')}</Label>
          <SearchInput id="sales-number" wrapperClassName="w-40" inputMode="numeric" value={numberText} maxLength={18} placeholder="1024"
            loading={(numberText === '' ? null : Number(numberText)) !== filters.saleNumber}
            onValueChange={(value) => setNumberText(value.replace(NOT_DIGIT, ''))} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sales-seller">{t('sales.columns.seller')}</Label>
          <Select id="sales-seller" className="h-9 w-52" value={filters.sellerId === null ? ALL : String(filters.sellerId)}
            onValueChange={(value) => changeFilters({ sellerId: !value || value === ALL ? null : Number(value) })}
            options={[
              { value: ALL, label: t('sales.filters.allSellers') },
              ...sellers.map((seller) => ({ value: String(seller.id), label: seller.name })),
            ]} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sales-customer">{t('sales.columns.customer')}</Label>
          <CustomerFilter id="sales-customer" value={customer} onChange={(next) => {
            setCustomer(next)
            changeFilters({ customerId: next?.id ?? null })
          }} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sales-status">{t('sales.columns.status')}</Label>
          <Select id="sales-status" className="h-9 w-40" value={filters.status ?? ALL}
            onValueChange={(value) => changeFilters({ status: !value || value === ALL ? null : value as SaleStatus })}
            options={[
              { value: ALL, label: t('sales.filters.allStatuses') },
              ...statuses.map((status) => ({ value: status, label: t(`sales.status.${status}`) })),
            ]} />
        </div>
      </div>
      {byNumber && <p className="-mt-3 text-xs text-muted-foreground">{t('sales.filters.numberHint')}</p>}

      {sales.isPending ? (
        <TableSkeleton />
      ) : sales.isError ? (
        <ErrorAlert message={errorMessage(sales.error)} />
      ) : (
        <Card className="gap-0 py-0">
          {rows.length === 0 ? (
            <EmptyState icon={Receipt} text={t('sales.empty')} />
          ) : (
            <Table stickyHeader>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <SortableHead field="saleNumber" first="desc" sort={sort} onSort={changeSort} className="pl-4">{t('sales.columns.number')}</SortableHead>
                  <SortableHead field="saleDate" first="desc" sort={sort} onSort={changeSort}>{t('sales.columns.date')}</SortableHead>
                  <SortableHead field="customer" sort={sort} onSort={changeSort} className="hidden md:table-cell">{t('sales.columns.customer')}</SortableHead>
                  <SortableHead field="seller" sort={sort} onSort={changeSort} className="hidden lg:table-cell">{t('sales.columns.seller')}</SortableHead>
                  <SortableHead field="paymentMethod" sort={sort} onSort={changeSort} className="hidden sm:table-cell">{t('sales.columns.payment')}</SortableHead>
                  <SortableHead field="total" first="desc" align="right" sort={sort} onSort={changeSort}>{t('sales.columns.total')}</SortableHead>
                  <TableHead className="w-24 pr-4"><span className="sr-only">{t('sales.columns.actions')}</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((sale) => {
                  const cancelled = sale.status === 'CANCELLED'
                  return (
                    <TableRow key={sale.id} className="cursor-pointer" onClick={() => setViewing(sale.id!)}>
                      <TableCell className="pl-4">
                        <span className="flex items-center gap-2">
                          <span className="font-medium tabular-nums">#{sale.saleNumber}</span>
                          {cancelled && <Badge variant="destructive">{t('sales.status.CANCELLED')}</Badge>}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{when.format(new Date(sale.saleDate!))}</TableCell>
                      <TableCell className="hidden max-w-48 truncate md:table-cell">{sale.customer?.name}</TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">{sale.seller?.name}</TableCell>
                      <TableCell className="hidden sm:table-cell">{t(`checkout.paymentMethods.${sale.paymentMethod!}`)}</TableCell>
                      <TableCell className={cn('text-right font-medium tabular-nums', cancelled && 'text-muted-foreground line-through')}>
                        {formatMoney(sale.total!)}
                      </TableCell>
                      <TableCell className="pr-4 text-right whitespace-nowrap" onClick={(event) => event.stopPropagation()}>
                        <Button variant="ghost" size="icon" aria-label={t('drawer.viewTicket', { number: sale.saleNumber })}
                          onClick={() => setViewing(sale.id!)}>
                          <Eye />
                        </Button>
                        {!cancelled && (
                          <Button variant="ghost" size="icon" aria-label={t('drawer.cancelTicket', { number: sale.saleNumber })}
                            className="text-muted-foreground hover:text-destructive" onClick={() => setCancelling(sale)}>
                            <Ban />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
          <Pagination page={page} pageSize={pageSize} total={sales.data.page?.totalElements ?? 0}
            loading={sales.isPlaceholderData} onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(0)
            }} />
        </Card>
      )}

      <SaleDetailDialog saleId={viewing} canCancel onClose={() => setViewing(null)} />
      <CancelSaleDialog sale={cancelling} onOpenChange={(open) => !open && setCancelling(null)} />
    </div>
  )
}

// The period's figures (and the chosen seller's), from the sales report: completed sales only,
// cancellations apart.
function SummaryTiles({ report }: { report?: SaleReport }) {
  const { t } = useTranslation()
  const methods = report?.byPaymentMethod ?? []
  const total = report?.completed?.total ?? 0
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t('sales.stats.sales')} value={report && formatMoney(report.completed!.total!)}
          hint={t('sales.stats.salesCount', { count: report?.completed?.saleCount ?? 0 })} />
        <StatTile label={t('sales.stats.averageTicket')} value={report && formatMoney(report.averageTicket!)}
          hint={t('sales.stats.averageTicketHint')} />
        <StatTile label={t('sales.stats.vat')} value={report && formatMoney(report.completed!.tax!)}
          hint={t('sales.stats.vatHint', { amount: formatMoney(report?.completed?.subtotal ?? 0) })} />
        <StatTile label={t('sales.stats.cancelled')} value={report && formatMoney(report.cancelled!.total!)}
          hint={t('sales.stats.cancelledCount', { count: report?.cancelled?.saleCount ?? 0 })} />
      </div>
      {methods.length > 0 && total > 0 && (
        <div className="grid gap-2">
          {/* Share of each payment method in the period's sales. */}
          <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            {methods.map((method, index) => (
              <span key={method.paymentMethod} className={cn('h-full', methodColors[index % methodColors.length])}
                style={{ width: `${((method.total ?? 0) / total) * 100}%` }} />
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            {methods.map((method, index) => (
              <li key={method.paymentMethod} className="flex items-center gap-1.5">
                <span className={cn('size-2 rounded-full', methodColors[index % methodColors.length])} />
                {t('sales.stats.method', {
                  method: t(`checkout.paymentMethods.${method.paymentMethod!}`),
                  amount: formatMoney(method.total ?? 0),
                  count: method.saleCount ?? 0,
                })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

const methodColors = ['bg-primary', 'bg-primary/60', 'bg-primary/30']
