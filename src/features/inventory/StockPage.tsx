import { FileSpreadsheet, History, Package, PackageOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { errorMessage } from '@/api/errors'
import { EmptyState } from '@/components/EmptyState'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Highlight } from '@/components/Highlight'
import { Pagination } from '@/components/Pagination'
import { SearchInput } from '@/components/SearchInput'
import { SortableHead } from '@/components/SortableHead'
import { StatTile } from '@/components/StatTile'
import { TableSkeleton } from '@/components/TableSkeleton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { categoryName } from '@/features/categories/category-labels'
import { useCategories } from '@/features/categories/queries'
import { useLabeledCategories } from '@/features/categories/use-labeled-categories'
import { ProductThumbnail } from '@/features/products/ProductThumbnail'
import { type Product, type ProductFilters, useProducts } from '@/features/products/queries'
import { downloadWorkbook } from '@/lib/excel'
import { useReportMeta } from '@/lib/report-meta'
import { type SortState } from '@/lib/sort'
import { usePageSize } from '@/lib/use-page-size'
import { cn } from '@/lib/utils'

import { AdjustStockDialog } from './AdjustStockDialog'
import { stockWorkbook } from './inventory-reports'
import { fetchAllProducts, useLowStockCount, useStockCounts } from './queries'
import { StockBadge } from './StockBadge'

// Waits for a pause in typing before searching, so each keystroke isn't a request.
const SEARCH_DELAY_MS = 300

type Status = 'all' | 'low' | 'inactive'

// Stock of every product with its minimum, a quick adjustment and its ledger. Inactive products
// can still be adjusted, to write off what is left.
export function StockPage() {
  const { t } = useTranslation()
  const [searchText, setSearchText] = useState('')
  const [filters, setFilters] = useState<ProductFilters>({ search: '', categoryId: null, active: true, lowStock: false })
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = usePageSize('stock')
  // Column order; null keeps the list's default.
  const [sort, setSort] = useState<SortState | null>(null)
  const [adjusting, setAdjusting] = useState<Product | null>(null)
  const [exporting, setExporting] = useState(false)
  const reportMeta = useReportMeta()
  const products = useProducts(filters, page, pageSize, sort)
  const changeSort = (next: SortState | null) => {
    setSort(next)
    setPage(0)
  }
  const categories = useLabeledCategories(useCategories().data)
  const counts = useStockCounts()
  const lowStock = useLowStockCount()

  const changeFilters = (change: Partial<ProductFilters>) => {
    setFilters((current) => ({ ...current, ...change }))
    setPage(0)
  }

  useEffect(() => {
    const search = searchText.trim()
    if (search === filters.search) {
      return
    }
    const timer = window.setTimeout(() => {
      setFilters((current) => ({ ...current, search }))
      setPage(0)
    }, SEARCH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [searchText, filters.search])

  async function exportExcel() {
    setExporting(true)
    try {
      const { products: all, truncated } = await fetchAllProducts(filters, sort)
      if (truncated) {
        toast.warning(t('excel.truncated', { count: all.length }))
      }
      const category = categories.find((option) => option.id === filters.categoryId)
      await downloadWorkbook(t('excel.files.stock'), stockWorkbook({
        t, products: all, truncated,
        info: [
          [t('products.category'), category?.label ?? t('products.allCategories')],
          [t('products.status'), t(`inventory.filters.${status}`)],
          ...(filters.search ? [[t('excel.search'), filters.search] as [string, string]] : []),
        ],
      }), reportMeta)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setExporting(false)
    }
  }

  const status: Status = !filters.active ? 'inactive' : filters.lowStock ? 'low' : 'all'
  const filtered = filters.search !== '' || filters.categoryId !== null || status !== 'all'
  const rows = products.data?.content ?? []

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile label={t('inventory.stats.active')} value={counts.data?.active} hint={t('inventory.stats.activeHint')} />
        <StatTile label={t('inventory.stats.low')}
          value={lowStock.data === undefined ? undefined : (
            <span className={cn(lowStock.data > 0 && 'text-destructive')}>{lowStock.data}</span>
          )}
          hint={<Link to="/inventory/low-stock" className="underline-offset-4 hover:underline">{t('inventory.stats.lowHint')}</Link>} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput wrapperClassName="min-w-56 flex-1" value={searchText} onValueChange={setSearchText}
          loading={searchText.trim() !== filters.search || (products.isFetching && products.isPlaceholderData)}
          placeholder={t('products.searchPlaceholder')} aria-label={t('products.searchLabel')} />
        <Select aria-label={t('products.category')} className="h-9 w-52"
          value={filters.categoryId === null ? 'all' : String(filters.categoryId)}
          onValueChange={(value) => changeFilters({ categoryId: !value || value === 'all' ? null : Number(value) })}
          options={[
            { value: 'all', label: t('products.allCategories') },
            ...categories.map((category) => ({ value: String(category.id), label: category.label })),
          ]} />
        <Select aria-label={t('products.status')} className="h-9 w-48" value={status}
          onValueChange={(value) => changeFilters({ active: value !== 'inactive', lowStock: value === 'low' })}
          options={[
            { value: 'all', label: t('inventory.filters.all') },
            { value: 'low', label: t('inventory.filters.low') },
            { value: 'inactive', label: t('inventory.filters.inactive') },
          ]} />
        <Button variant="outline" className="h-9" disabled={exporting || rows.length === 0} onClick={() => void exportExcel()}>
          <FileSpreadsheet />
          {exporting ? t('excel.exporting') : t('inventory.export')}
        </Button>
      </div>

      {products.isPending ? (
        <TableSkeleton />
      ) : products.isError ? (
        <ErrorAlert message={errorMessage(products.error)} />
      ) : (
        <Card className="gap-0 py-0">
          {rows.length === 0 ? (
            <EmptyState icon={Package} text={filtered ? t('products.noMatches') : t('products.empty')} />
          ) : (
            <Table stickyHeader>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <SortableHead field="name" sort={sort} onSort={changeSort} className="pl-4">{t('products.columns.product')}</SortableHead>
                  <SortableHead field="category" sort={sort} onSort={changeSort} className="hidden lg:table-cell">{t('products.columns.category')}</SortableHead>
                  <SortableHead field="stock" first="desc" align="right" sort={sort} onSort={changeSort}>{t('inventory.columns.stock')}</SortableHead>
                  <SortableHead field="minStock" first="desc" align="right" sort={sort} onSort={changeSort} className="hidden sm:table-cell">{t('inventory.columns.min')}</SortableHead>
                  <TableHead className="hidden md:table-cell">{t('inventory.columns.status')}</TableHead>
                  <TableHead className="pr-4 text-center">{t('inventory.columns.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((product) => (
                  <TableRow key={product.id} className={cn(!product.active && 'text-muted-foreground')}>
                    <TableCell className="pl-4">
                      <span className="flex items-center gap-3">
                        <ProductThumbnail key={product.imageUrl} url={product.imageUrl} className="size-9" />
                        <span className="grid min-w-0">
                          <span className="truncate font-medium text-foreground"><Highlight text={product.name} query={filters.search} /></span>
                          <span className="truncate font-mono text-xs text-muted-foreground">
                            <Highlight text={[product.sku, product.barcode].filter(Boolean).join(' · ')} query={filters.search} />
                          </span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{categoryName(product.category?.name, t)}</TableCell>
                    <TableCell className={cn('text-right text-base font-semibold tabular-nums',
                      product.active && (product.stock ?? 0) <= 0 && 'text-destructive')}>
                      {product.stock}
                    </TableCell>
                    <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">{product.minStock}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {product.active
                        ? <StockBadge stock={product.stock ?? 0} lowStock={!!product.lowStock} />
                        : <span className="text-xs">{t('inventory.status.inactive')}</span>}
                    </TableCell>
                    <TableCell className="pr-4 whitespace-nowrap">
                      {/* Labeled buttons centered under the header; narrow screens keep only the icons. */}
                      <div className="flex justify-center gap-2">
                        <Button variant="outline" size="sm" aria-label={t('inventory.adjust.open', { name: product.name })}
                          title={t('inventory.adjust.hint')} onClick={() => setAdjusting(product)}>
                          <PackageOpen />
                          <span className="hidden sm:inline">{t('inventory.adjust.button')}</span>
                        </Button>
                        {/* A link rendered as the same button, so both look alike. */}
                        <Button variant="outline" size="sm" nativeButton={false} title={t('inventory.ledger.hint')}
                          aria-label={t('inventory.ledger.openFor', { name: product.name })}
                          render={<Link to={`/inventory/movements?productId=${product.id}`} />}>
                          <History />
                          <span className="hidden sm:inline">{t('inventory.ledger.button')}</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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

      <AdjustStockDialog product={adjusting} onOpenChange={(open) => !open && setAdjusting(null)} />
    </div>
  )
}
