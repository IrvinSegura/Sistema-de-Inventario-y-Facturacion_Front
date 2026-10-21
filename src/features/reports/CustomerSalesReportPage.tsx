import { Contact, FileSpreadsheet } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { errorMessage } from '@/api/errors'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { EmptyState } from '@/components/EmptyState'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Pagination } from '@/components/Pagination'
import { TableSkeleton } from '@/components/TableSkeleton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MAX_REPORT_DAYS } from '@/features/sales/queries'
import { formatDate, formatStoreDate } from '@/lib/date-format'
import { type DayRange, lastDaysRange } from '@/lib/days'
import { downloadWorkbook } from '@/lib/excel'
import { formatMoney } from '@/lib/money'
import { useReportMeta } from '@/lib/report-meta'
import { usePageSize } from '@/lib/use-page-size'

import { formatCount } from './format'
import { fetchAllCustomerSales, MAX_EXPORT_ROWS, useCustomerSales } from './queries'
import { customerSalesWorkbook } from './reports-excel'

const DEFAULT_RANGE_DAYS = 30

/**
 * Registered customers by what they bought in the period, best first; the walk-in customer is left
 * out. Managers only.
 */
export function CustomerSalesReportPage() {
  const { t, i18n } = useTranslation()
  const [range, setRange] = useState<DayRange>(() => lastDaysRange(DEFAULT_RANGE_DAYS))
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = usePageSize('report-customers')
  const [exporting, setExporting] = useState(false)
  const customers = useCustomerSales(range, page, pageSize)
  const reportMeta = useReportMeta()
  const rows = customers.data?.content ?? []

  async function exportExcel() {
    setExporting(true)
    try {
      const { rows: all, truncated } = await fetchAllCustomerSales(range)
      if (truncated) {
        toast.warning(t('excel.truncated', { count: MAX_EXPORT_ROWS }))
      }
      const period = t('excel.period', { from: formatDate(range.from, i18n.language), to: formatDate(range.to, i18n.language) })
      await downloadWorkbook(`${t('excel.files.customerSales')}_${range.from}_${range.to}`,
        customerSalesWorkbook({ t, rows: all, period, truncated }), reportMeta)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <DateRangeFilter value={range} maxDays={MAX_REPORT_DAYS} onChange={(next) => {
          setRange(next)
          setPage(0)
        }} />
        <Button variant="outline" className="h-9" disabled={exporting || rows.length === 0} onClick={() => void exportExcel()}>
          <FileSpreadsheet />
          {exporting ? t('excel.exporting') : t('reports.export')}
        </Button>
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">{t('reports.customers.hint')}</p>

      {customers.isPending ? (
        <TableSkeleton />
      ) : customers.isError ? (
        <ErrorAlert message={errorMessage(customers.error)} />
      ) : (
        <Card className="gap-0 py-0">
          {rows.length === 0 ? (
            <EmptyState icon={Contact} text={t('reports.customers.empty')} />
          ) : (
            <Table stickyHeader>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-12 pl-4">#</TableHead>
                  <TableHead>{t('sales.columns.customer')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('reports.customers.taxId')}</TableHead>
                  <TableHead className="text-right">{t('excel.sales.tickets')}</TableHead>
                  <TableHead className="text-right">{t('sales.columns.total')}</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">{t('sales.stats.averageTicket')}</TableHead>
                  <TableHead className="hidden pr-4 text-right lg:table-cell">{t('reports.customers.lastPurchase')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((customer, index) => (
                  <TableRow key={customer.customerId}>
                    <TableCell className="pl-4 text-muted-foreground tabular-nums">{page * pageSize + index + 1}</TableCell>
                    <TableCell className="max-w-64 truncate font-medium">{customer.name}</TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">{customer.taxId ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCount(customer.saleCount ?? 0, i18n.language)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatMoney(customer.total ?? 0)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatMoney(customer.averageTicket ?? 0)}</TableCell>
                    <TableCell className="hidden pr-4 text-right text-muted-foreground lg:table-cell">
                      {customer.lastSaleDate && formatStoreDate(customer.lastSaleDate, i18n.language)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <Pagination page={page} pageSize={pageSize} total={customers.data.page?.totalElements ?? 0}
            loading={customers.isPlaceholderData} onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(0)
            }} />
        </Card>
      )}
    </div>
  )
}
