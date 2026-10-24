import { Ban, FileSpreadsheet, Receipt } from 'lucide-react'
import { startTransition, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
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
import { useCustomer } from '@/features/customers/queries'
import { formatDate, formatDateTime } from '@/lib/date-format'
import { daysInRange } from '@/lib/days'
import { downloadWorkbook } from '@/lib/excel'
import { formatMoney } from '@/lib/money'
import { useReportMeta } from '@/lib/report-meta'
import { readPositiveInt } from '@/lib/search-params'
import { type SortState } from '@/lib/sort'
import { NOT_DIGIT } from '@/lib/text-rules'
import { usePageSize } from '@/lib/use-page-size'
import { useToday } from '@/lib/use-today'
import { cn } from '@/lib/utils'

import { type CustomerRef, CustomerFilter } from './CustomerFilter'
import {
  fetchAllSales,
  fetchSalesReport,
  MAX_EXPORT_ROWS,
  MAX_REPORT_DAYS,
  type SaleDateField,
  type SaleFilters,
  type SaleReport,
  type SaleStatus,
  type SaleSummary,
  useSales,
  useSalesSummary,
} from './queries'
import { effectiveSort, readSaleFilters, SALE_DATE_FIELDS, SALE_STATUSES, saleFilterParams } from './sale-params'
import { SaleDetailDialog } from './SaleDetailDialog'
import { salesWorkbook } from './sales-report'
import { useSellerOptions } from './use-seller-options'
import { ViewTicketButton } from './ViewTicketButton'

// Waits for a pause in typing before searching, so each keystroke isn't a request.
const SEARCH_DELAY_MS = 300
const ALL = 'all'

/**
 * Every sale of the store (admins and supervisors): the period's totals, filters by ticket, seller,
 * customer, status and sale or cancellation date, and each ticket to see, reprint or cancel. The
 * filters are in the URL, so a link (e.g. from Supervision) opens the list already filtered.
 */
export function SalesPage() {
  const { t, i18n } = useTranslation()
  const today = useToday()
  const [params, setParams] = useSearchParams()
  const filters = readSaleFilters(params, today)
  const [numberText, setNumberText] = useState(() => filters.saleNumber?.toString() ?? '')
  const [syncedNumber, setSyncedNumber] = useState(filters.saleNumber)
  // A link or the back button can change the ticket number under the input: follow it.
  if (filters.saleNumber !== syncedNumber) {
    setSyncedNumber(filters.saleNumber)
    setNumberText(filters.saleNumber?.toString() ?? '')
  }
  // The customer picked here; one that only comes in the URL is named by fetching it.
  const [picked, setPicked] = useState<CustomerRef | null>(null)
  const linkedCustomer = useCustomer(filters.customerId !== null && picked?.id !== filters.customerId ? filters.customerId : null)
  const customer: CustomerRef | null = filters.customerId === null
    ? null
    : picked?.id === filters.customerId
      ? picked
      : { id: filters.customerId, name: linkedCustomer.data?.name ?? `#${filters.customerId}` }
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = usePageSize('sales')
  // Column order; null keeps the list's default.
  const [sort, setSort] = useState<SortState | null>(null)
  // Any filter change, from this page or a link, starts again from the first page.
  const [shownParams, setShownParams] = useState(() => params.toString())
  if (params.toString() !== shownParams) {
    setShownParams(params.toString())
    setPage(0)
  }
  const [viewing, setViewing] = useState<number | null>(null)
  const [cancelling, setCancelling] = useState<SaleSummary | null>(null)
  const [exporting, setExporting] = useState(false)
  const activeSort = effectiveSort(sort, filters.dateField)
  const sales = useSales(filters, page, pageSize, activeSort)
  const changeSort = (next: SortState | null) => {
    setSort(next)
    setPage(0)
  }
  const reportable = daysInRange(filters.range) <= MAX_REPORT_DAYS
  const byCancellation = filters.dateField === 'cancelledAt'
  // The report counts sales by the day they were rung up, so it can't sum a cancellation period.
  const summary = useSalesSummary(filters.range, filters.sellerId, reportable && !byCancellation)
  const sellers = useSellerOptions()
  const reportMeta = useReportMeta()
  const byNumber = filters.saleNumber !== null

  // Replaces the history entry: Back leaves the page instead of undoing filters one by one.
  const changeFilters = (change: Partial<SaleFilters>) => {
    setParams(saleFilterParams({ ...filters, ...change }), { replace: true })
  }

  // "0" or "007" isn't a ticket number until it reads as one.
  const typedNumber = readPositiveInt(numberText)
  useEffect(() => {
    if (typedNumber === filters.saleNumber) {
      return
    }
    const timer = window.setTimeout(() => {
      // One render for both: the router applies the URL in a transition, and syncing first would
      // briefly put the old number back in the input.
      startTransition(() => {
        setSyncedNumber(typedNumber)
        setParams(saleFilterParams({ ...readSaleFilters(params, today), saleNumber: typedNumber }), { replace: true })
      })
    }, SEARCH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [typedNumber, filters.saleNumber, params, today, setParams])

  async function exportExcel() {
    setExporting(true)
    try {
      const [{ sales: all, truncated }, report] = await Promise.all([
        fetchAllSales(filters, activeSort),
        // A ticket number search spans every date, and the report goes by sale date: neither would match it.
        reportable && !byNumber && !byCancellation ? fetchSalesReport(filters.range, filters.sellerId) : Promise.resolve(undefined),
      ])
      if (truncated) {
        toast.warning(t('sales.exportTruncated', { count: MAX_EXPORT_ROWS }))
      }
      const seller = sellers.find((option) => option.id === filters.sellerId)
      const info: [string, string][] = [
        [t('sales.columns.seller'), seller?.name ?? t('sales.filters.allSellers')],
        [t('sales.columns.customer'), customer?.name ?? t('excel.anyCustomer')],
        [t('sales.columns.status'), filters.status ? t(`sales.status.${filters.status}`) : t('sales.filters.allStatuses')],
        [t('sales.filters.dateField'), t(`sales.filters.dateFields.${filters.dateField}`)],
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

      <div className="flex flex-wrap items-end gap-3">
        <DateRangeFilter value={filters.range} disabled={byNumber} onChange={(range) => changeFilters({ range })} />
        <div className="grid gap-2">
          <Label htmlFor="sales-date-field">{t('sales.filters.dateField')}</Label>
          <Select id="sales-date-field" className="h-9 w-48" value={filters.dateField} disabled={byNumber}
            onValueChange={(value) => value && changeFilters({ dateField: value as SaleDateField })}
            options={SALE_DATE_FIELDS.map((field) => ({ value: field, label: t(`sales.filters.dateFields.${field}`) }))} />
        </div>
      </div>

      {byCancellation ? (
        <p className="text-sm text-muted-foreground">{t('sales.summaryBySaleDate')}</p>
      ) : reportable ? (
        <SummaryTiles report={summary.data} />
      ) : (
        <p className="text-sm text-muted-foreground">{t('sales.summaryTooLong', { count: MAX_REPORT_DAYS })}</p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <Label htmlFor="sales-number">{t('sales.filters.number')}</Label>
          <SearchInput id="sales-number" wrapperClassName="w-40" inputMode="numeric" value={numberText} maxLength={15} placeholder="1024"
            loading={typedNumber !== filters.saleNumber}
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
            setPicked(next)
            changeFilters({ customerId: next?.id ?? null })
          }} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sales-status">{t('sales.columns.status')}</Label>
          {/* By cancellation date only cancelled sales match. */}
          <Select id="sales-status" className="h-9 w-40" value={filters.status ?? ALL} disabled={byCancellation}
            onValueChange={(value) => changeFilters({ status: !value || value === ALL ? null : value as SaleStatus })}
            options={[
              { value: ALL, label: t('sales.filters.allStatuses') },
              ...SALE_STATUSES.map((option) => ({ value: option, label: t(`sales.status.${option}`) })),
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
                  <SortableHead field="saleNumber" first="desc" sort={activeSort} onSort={changeSort} className="pl-4">{t('sales.columns.number')}</SortableHead>
                  <SortableHead field={filters.dateField} first="desc" sort={activeSort} onSort={changeSort}>
                    {byCancellation ? t('sales.filters.dateFields.cancelledAt') : t('sales.columns.date')}
                  </SortableHead>
                  <SortableHead field="customer" sort={activeSort} onSort={changeSort} className="hidden md:table-cell">{t('sales.columns.customer')}</SortableHead>
                  <SortableHead field="seller" sort={activeSort} onSort={changeSort} className="hidden lg:table-cell">{t('sales.columns.seller')}</SortableHead>
                  <SortableHead field="paymentMethod" sort={activeSort} onSort={changeSort} className="hidden sm:table-cell">{t('sales.columns.payment')}</SortableHead>
                  <SortableHead field="total" first="desc" align="right" sort={activeSort} onSort={changeSort}>{t('sales.columns.total')}</SortableHead>
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
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(byCancellation ? sale.cancellation?.cancelledAt : sale.saleDate, i18n.language)}
                      </TableCell>
                      <TableCell className="hidden max-w-48 truncate md:table-cell">{sale.customer?.name}</TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">{sale.seller?.name}</TableCell>
                      <TableCell className="hidden sm:table-cell">{t(`checkout.paymentMethods.${sale.paymentMethod!}`)}</TableCell>
                      <TableCell className={cn('text-right font-medium tabular-nums', cancelled && 'text-muted-foreground line-through')}>
                        {formatMoney(sale.total!)}
                      </TableCell>
                      <TableCell className="pr-4 text-right whitespace-nowrap" onClick={(event) => event.stopPropagation()}>
                        <ViewTicketButton saleNumber={sale.saleNumber} onClick={() => setViewing(sale.id!)} />
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

/**
 * The period's figures (and the chosen seller's), from the sales report: completed sales only,
 * cancellations apart.
 */
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

// One shade per payment method (cash, card, transfer); add one if the API adds a method.
const methodColors = ['bg-primary', 'bg-primary/60', 'bg-primary/30']
