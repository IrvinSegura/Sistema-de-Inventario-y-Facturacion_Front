import { Eye, FileSpreadsheet, Truck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { errorMessage } from '@/api/errors'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { EmptyState } from '@/components/EmptyState'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Pagination } from '@/components/Pagination'
import { SortableHead } from '@/components/SortableHead'
import { StatTile } from '@/components/StatTile'
import { TableSkeleton } from '@/components/TableSkeleton'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatDateTime } from '@/lib/date-format'
import { daysInRange, lastDaysRange } from '@/lib/days'
import { downloadWorkbook } from '@/lib/excel'
import { formatMoney, fromCents, toCents } from '@/lib/money'
import { useReportMeta } from '@/lib/report-meta'
import { type SortState } from '@/lib/sort'
import { usePageSize } from '@/lib/use-page-size'
import { cn } from '@/lib/utils'

import { PurchaseDetailDialog } from './PurchaseDetailDialog'
import { purchasesWorkbook } from './purchases-report'
import {
  fetchAllPurchases,
  fetchPurchaseDetails,
  MAX_DETAILED_PURCHASES,
  MAX_EXPORT_ROWS,
  MAX_REPORT_DAYS,
  type PurchaseFilters,
  type PurchaseReport,
  useAllSuppliers,
  usePurchaseReport,
  usePurchases,
} from './queries'

const ALL_SUPPLIERS = 'all'
const DEFAULT_RANGE_DAYS = 30

/** Purchases by period and supplier, with the period's figures (up to MAX_REPORT_DAYS) and the Excel export. */
export function PurchasesPage() {
  const { t, i18n } = useTranslation()
  const [filters, setFilters] = useState<PurchaseFilters>(() => ({ range: lastDaysRange(DEFAULT_RANGE_DAYS), supplierId: null }))
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = usePageSize('purchases')
  // Column order; null keeps the list's default.
  const [sort, setSort] = useState<SortState | null>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)
  const reportMeta = useReportMeta()
  const purchases = usePurchases(filters, page, pageSize, sort)
  const changeSort = (next: SortState | null) => {
    setSort(next)
    setPage(0)
  }
  const reportable = daysInRange(filters.range) <= MAX_REPORT_DAYS
  const report = usePurchaseReport(filters.range, filters.supplierId, reportable)
  const suppliers = useAllSuppliers()
  const rows = purchases.data?.content ?? []

  const changeFilters = (change: Partial<PurchaseFilters>) => {
    setFilters((current) => ({ ...current, ...change }))
    setPage(0)
  }

  const summary = report.data && summarize(report.data)

  async function exportExcel() {
    setExporting(true)
    try {
      const { purchases: all, truncated } = await fetchAllPurchases(filters, sort)
      if (truncated) {
        toast.warning(t('purchases.exportTruncated', { count: MAX_EXPORT_ROWS }))
      }
      const details = all.length <= MAX_DETAILED_PURCHASES ? await fetchPurchaseDetails(all.map((purchase) => purchase.id!)) : null
      const supplier = suppliers.data?.find((option) => option.id === filters.supplierId)
      const period = t('excel.period', {
        from: formatDate(filters.range.from, i18n.language), to: formatDate(filters.range.to, i18n.language),
      })
      await downloadWorkbook(`${t('excel.files.purchases')}_${filters.range.from}_${filters.range.to}`,
        purchasesWorkbook({
          t, purchases: all, truncated, details, period,
          info: [[t('purchases.columns.supplier'), supplier?.name ?? t('purchases.allSuppliers')]],
        }), reportMeta)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <DateRangeFilter value={filters.range} onChange={(range) => changeFilters({ range })} />
          <div className="grid gap-2">
            <Label htmlFor="purchases-supplier">{t('purchases.columns.supplier')}</Label>
            <Select id="purchases-supplier" className="h-9 w-56"
              value={filters.supplierId === null ? ALL_SUPPLIERS : String(filters.supplierId)}
              onValueChange={(value) => changeFilters({ supplierId: !value || value === ALL_SUPPLIERS ? null : Number(value) })}
              options={[
                { value: ALL_SUPPLIERS, label: t('purchases.allSuppliers') },
                // Inactive suppliers stay (labelled) so their past purchases can still be filtered.
                ...(suppliers.data ?? []).map((supplier) => ({
                  value: String(supplier.id),
                  label: supplier.active ? supplier.name : t('purchases.inactiveSupplier', { name: supplier.name }),
                })),
              ]} />
          </div>
        </div>
        <Button variant="outline" className="h-9" disabled={exporting || rows.length === 0} onClick={() => void exportExcel()}>
          <FileSpreadsheet />
          {exporting ? t('excel.exporting') : t('purchases.export')}
        </Button>
      </div>

      {!reportable && <p className="text-sm text-muted-foreground">{t('purchases.summaryTooLong', { count: MAX_REPORT_DAYS })}</p>}
      <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', !reportable && 'hidden')}>
        <StatTile label={t('purchases.stats.spent')} value={summary && formatMoney(summary.total)}
          hint={t('purchases.stats.count', { count: summary?.count ?? 0 })} />
        <StatTile label={t('purchases.stats.average')} value={summary && formatMoney(summary.average)}
          hint={t('purchases.stats.averageHint')} />
        <StatTile label={t('purchases.stats.topSupplier')}
          value={summary && <span className="block truncate text-lg">{summary.topSupplier?.name ?? '—'}</span>}
          hint={summary?.topSupplier && t('purchases.stats.topSupplierHint', { amount: formatMoney(summary.topSupplier.total) })} />
        <StatTile label={t('purchases.stats.suppliers')} value={summary?.supplierCount}
          hint={t('purchases.stats.suppliersHint')} />
      </div>

      {purchases.isPending ? (
        <TableSkeleton />
      ) : purchases.isError ? (
        <ErrorAlert message={errorMessage(purchases.error)} />
      ) : (
        <Card className="gap-0 py-0">
          {rows.length === 0 ? (
            <EmptyState icon={Truck} text={t('purchases.empty')}>
              <Link to="/purchases/new" className={buttonVariants({ variant: 'outline' })}>{t('purchases.new')}</Link>
            </EmptyState>
          ) : (
            <Table stickyHeader>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <SortableHead field="id" first="desc" sort={sort} onSort={changeSort} className="pl-4">{t('purchases.columns.folio')}</SortableHead>
                  <SortableHead field="purchaseDate" first="desc" sort={sort} onSort={changeSort}>{t('purchases.columns.date')}</SortableHead>
                  <SortableHead field="supplier" sort={sort} onSort={changeSort}>{t('purchases.columns.supplier')}</SortableHead>
                  <SortableHead field="recordedBy" sort={sort} onSort={changeSort} className="hidden md:table-cell">{t('purchases.columns.recordedBy')}</SortableHead>
                  <SortableHead field="total" first="desc" align="right" sort={sort} onSort={changeSort}>{t('purchases.columns.total')}</SortableHead>
                  <TableHead className="w-12 pr-4"><span className="sr-only">{t('purchases.columns.actions')}</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((purchase) => (
                  <TableRow key={purchase.id} className="cursor-pointer" onClick={() => setViewing(purchase.id!)}>
                    <TableCell className="pl-4 font-medium tabular-nums">#{purchase.id}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateTime(purchase.purchaseDate, i18n.language)}</TableCell>
                    <TableCell className="max-w-56 truncate">{purchase.supplier?.name}</TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{purchase.recordedBy?.name}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatMoney(purchase.total!)}</TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button variant="ghost" size="icon" aria-label={t('purchases.view', { id: purchase.id })}
                        onClick={(event) => {
                          event.stopPropagation()
                          setViewing(purchase.id!)
                        }}>
                        <Eye />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <Pagination page={page} pageSize={pageSize} total={purchases.data.page?.totalElements ?? 0}
            loading={purchases.isPlaceholderData} onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(0)
            }} />
        </Card>
      )}

      <PurchaseDetailDialog purchaseId={viewing} onClose={() => setViewing(null)} />
    </div>
  )
}

/** The tiles' figures from the API's summary of the period. */
function summarize(report: PurchaseReport) {
  const count = report.purchaseCount ?? 0
  const total = report.total ?? 0
  const top = report.bySupplier?.[0]
  return {
    count,
    total,
    average: count > 0 ? fromCents(Math.round(toCents(total) / count)) : 0,
    supplierCount: report.bySupplier?.length ?? 0,
    topSupplier: top && { name: top.name ?? '', total: top.total ?? 0 },
  }
}
