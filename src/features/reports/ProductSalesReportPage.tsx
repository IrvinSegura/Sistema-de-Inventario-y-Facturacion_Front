import { FileSpreadsheet, PackageSearch } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { errorMessage } from '@/api/errors'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { EmptyState } from '@/components/EmptyState'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Pagination } from '@/components/Pagination'
import { TableSkeleton } from '@/components/TableSkeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { categoryName } from '@/features/categories/category-labels'
import { useCategories } from '@/features/categories/queries'
import { useLabeledCategories } from '@/features/categories/use-labeled-categories'
import { MAX_REPORT_DAYS } from '@/features/sales/queries'
import { formatDate, formatStoreDate } from '@/lib/date-format'
import { type DayRange, lastDaysRange } from '@/lib/days'
import { downloadWorkbook } from '@/lib/excel'
import { formatMoney } from '@/lib/money'
import { useReportMeta } from '@/lib/report-meta'
import { usePageSize } from '@/lib/use-page-size'
import { cn } from '@/lib/utils'

import { formatCount, formatPercent } from './format'
import { fetchAllProductSales, MAX_EXPORT_ROWS, type ProductSalesFilters, stockValue, useProductSales } from './queries'
import { productSalesWorkbook } from './reports-excel'

const DEFAULT_RANGE_DAYS = 30
const ALL = 'all'

/**
 * What each product sold in the period, with its cost and gross profit, or the products in stock that
 * didn't sell at all (money waiting on the shelf). Managers only.
 */
export function ProductSalesReportPage() {
  const { t, i18n } = useTranslation()
  const [filters, setFilters] = useState<ProductSalesFilters>(() => ({
    range: lastDaysRange(DEFAULT_RANGE_DAYS), categoryId: null, unsold: false,
  }))
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = usePageSize('report-products')
  const [exporting, setExporting] = useState(false)
  const products = useProductSales(filters, page, pageSize)
  const categories = useLabeledCategories(useCategories().data)
  const reportMeta = useReportMeta()
  const rows = products.data?.content ?? []

  const changeFilters = (change: Partial<ProductSalesFilters>) => {
    setFilters((current) => ({ ...current, ...change }))
    setPage(0)
  }

  async function exportExcel() {
    setExporting(true)
    try {
      const { rows: all, truncated } = await fetchAllProductSales(filters)
      if (truncated) {
        toast.warning(t('excel.truncated', { count: MAX_EXPORT_ROWS }))
      }
      const category = categories.find((option) => option.id === filters.categoryId)
      const period = t('excel.period', {
        from: formatDate(filters.range.from, i18n.language), to: formatDate(filters.range.to, i18n.language),
      })
      await downloadWorkbook(
        `${t(filters.unsold ? 'excel.files.unsoldProducts' : 'excel.files.productSales')}_${filters.range.from}_${filters.range.to}`,
        productSalesWorkbook({
          t, rows: all, unsold: filters.unsold, period, truncated,
          info: [[t('products.columns.category'), category?.label ?? t('products.allCategories')]],
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
          <DateRangeFilter value={filters.range} maxDays={MAX_REPORT_DAYS}
            onChange={(range: DayRange) => changeFilters({ range })} />
          <div className="grid gap-2">
            <Label htmlFor="report-products-category">{t('products.columns.category')}</Label>
            <Select id="report-products-category" className="h-9 w-52"
              value={filters.categoryId === null ? ALL : String(filters.categoryId)}
              onValueChange={(value) => changeFilters({ categoryId: !value || value === ALL ? null : Number(value) })}
              options={[
                { value: ALL, label: t('products.allCategories') },
                ...categories.map((category) => ({ value: String(category.id), label: category.label })),
              ]} />
          </div>
          <div role="group" aria-label={t('reports.products.mode')} className="flex h-9 rounded-lg bg-muted p-1">
            {[false, true].map((unsold) => (
              <button key={String(unsold)} type="button" aria-pressed={filters.unsold === unsold}
                onClick={() => changeFilters({ unsold })}
                className={cn(
                  'rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors outline-none',
                  'hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
                  filters.unsold === unsold && 'bg-background text-foreground shadow-sm',
                )}>
                {t(unsold ? 'reports.products.unsold' : 'reports.products.sold')}
              </button>
            ))}
          </div>
        </div>
        <Button variant="outline" className="h-9" disabled={exporting || rows.length === 0} onClick={() => void exportExcel()}>
          <FileSpreadsheet />
          {exporting ? t('excel.exporting') : t('reports.export')}
        </Button>
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">
        {t(filters.unsold ? 'reports.products.unsoldHint' : 'reports.products.soldHint')}
      </p>

      {products.isPending ? (
        <TableSkeleton />
      ) : products.isError ? (
        <ErrorAlert message={errorMessage(products.error)} />
      ) : (
        <Card className="gap-0 py-0">
          {rows.length === 0 ? (
            <EmptyState icon={PackageSearch} text={t(filters.unsold ? 'reports.products.unsoldEmpty' : 'reports.products.soldEmpty')} />
          ) : (
            <Table stickyHeader>
              <TableHeader className="bg-muted/50">
                {filters.unsold ? (
                  <TableRow>
                    <TableHead className="pl-4">{t('sales.detail.product')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('products.columns.category')}</TableHead>
                    <TableHead className="text-right">{t('reports.products.stock')}</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">{t('reports.products.averageCost')}</TableHead>
                    <TableHead className="text-right">{t('reports.products.stockValue')}</TableHead>
                    <TableHead className="hidden pr-4 text-right lg:table-cell">{t('reports.products.lastSale')}</TableHead>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableHead className="pl-4">{t('sales.detail.product')}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t('products.columns.category')}</TableHead>
                    <TableHead className="text-right">{t('excel.units')}</TableHead>
                    <TableHead className="text-right">{t('excel.sales.amountBeforeVat')}</TableHead>
                    <TableHead className="hidden text-right md:table-cell">{t('reports.products.cost')}</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">{t('reports.products.profit')}</TableHead>
                    <TableHead className="pr-4 text-right">{t('reports.products.margin')}</TableHead>
                  </TableRow>
                )}
              </TableHeader>
              <TableBody>
                {rows.map((product) => {
                  const name = (
                    <TableCell className="max-w-64 pl-4">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{product.name}</span>
                        {!product.active && <Badge variant="outline">{t('reports.products.inactive')}</Badge>}
                      </span>
                      <span className="block font-mono text-xs text-muted-foreground">{product.sku}</span>
                    </TableCell>
                  )
                  if (filters.unsold) {
                    const value = stockValue(product)
                    return (
                      <TableRow key={product.productId}>
                        {name}
                        <TableCell className="hidden md:table-cell">{categoryName(product.category?.name, t)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCount(product.stock ?? 0, i18n.language)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">
                          {product.averageCost === undefined || product.averageCost === null ? '—' : formatMoney(product.averageCost)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{value === null ? '—' : formatMoney(value)}</TableCell>
                        <TableCell className="hidden pr-4 text-right text-muted-foreground lg:table-cell">
                          {product.lastSaleDate ? formatStoreDate(product.lastSaleDate, i18n.language) : t('reports.products.never')}
                        </TableCell>
                      </TableRow>
                    )
                  }
                  const known = product.grossProfit !== undefined && product.grossProfit !== null
                  const margin = known && (product.subtotal ?? 0) > 0 ? product.grossProfit! / product.subtotal! : null
                  return (
                    <TableRow key={product.productId}>
                      {name}
                      <TableCell className="hidden lg:table-cell">{categoryName(product.category?.name, t)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCount(product.quantity ?? 0, i18n.language)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatMoney(product.subtotal ?? 0)}</TableCell>
                      <TableCell className="hidden text-right tabular-nums md:table-cell">
                        {known ? formatMoney(product.cost!) : '—'}
                      </TableCell>
                      <TableCell className={cn('hidden text-right tabular-nums sm:table-cell', known && product.grossProfit! < 0 && 'text-destructive')}>
                        {known ? formatMoney(product.grossProfit!) : '—'}
                      </TableCell>
                      <TableCell className={cn('pr-4 text-right tabular-nums', margin !== null && margin < 0 && 'text-destructive')}
                        title={known ? undefined : t('reports.products.noCost')}>
                        {margin === null ? '—' : formatPercent(margin, i18n.language)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
          <Pagination page={page} pageSize={pageSize} total={products.data.page?.totalElements ?? 0}
            loading={products.isPlaceholderData} onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(0)
            }} />
        </Card>
      )}
      {!filters.unsold && rows.some((product) => product.cost === undefined || product.cost === null) && (
        <p className="text-xs text-muted-foreground">{t('reports.products.noCostHint')}</p>
      )}
    </div>
  )
}
