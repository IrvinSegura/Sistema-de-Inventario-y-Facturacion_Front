import { CircleCheck, FileSpreadsheet, ShoppingBasket } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { errorMessage } from '@/api/errors'
import { EmptyState } from '@/components/EmptyState'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Pagination } from '@/components/Pagination'
import { TableSkeleton } from '@/components/TableSkeleton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { categoryName } from '@/features/categories/category-labels'
import { useCategories } from '@/features/categories/queries'
import { useLabeledCategories } from '@/features/categories/use-labeled-categories'
import type { DraftState } from '@/features/purchases/purchase-draft'
import { downloadWorkbook } from '@/lib/excel'
import { useReportMeta } from '@/lib/report-meta'
import { usePageSize } from '@/lib/use-page-size'
import { cn } from '@/lib/utils'

import { lowStockWorkbook } from './inventory-reports'
import { fetchAllLowStock, type LowStockProduct, useLowStockPage } from './queries'
import { StockBadge } from './StockBadge'

/** Units to order: enough to get back to the minimum, at least one. */
function suggested(product: LowStockProduct) {
  return Math.max(product.shortage ?? 0, 1)
}

function toDraft(products: LowStockProduct[]): DraftState {
  return {
    lines: products.map((product) => ({
      productId: product.productId!, sku: product.sku!, name: product.name!, stock: product.stock,
      quantity: String(suggested(product)),
    })),
  }
}

/**
 * Active products at or below their minimum, most urgent first; pick some (or all) to restock them
 * in one purchase.
 */
export function LowStockPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = usePageSize('low-stock')
  // Whole products, not just ids: the selection survives paging and filtering and goes straight into the purchase draft.
  const [selected, setSelected] = useState<Map<number, LowStockProduct>>(new Map())
  const [loadingAll, setLoadingAll] = useState(false)
  const products = useLowStockPage(categoryId, page, pageSize)
  const categories = useLabeledCategories(useCategories().data)
  const reportMeta = useReportMeta()
  const rows = products.data?.content ?? []
  const allOnPage = rows.length > 0 && rows.every((product) => selected.has(product.productId!))

  function toggle(product: LowStockProduct) {
    setSelected((current) => {
      const next = new Map(current)
      if (next.has(product.productId!)) {
        next.delete(product.productId!)
      } else {
        next.set(product.productId!, product)
      }
      return next
    })
  }

  function togglePage() {
    setSelected((current) => {
      const next = new Map(current)
      rows.forEach((product) => allOnPage ? next.delete(product.productId!) : next.set(product.productId!, product))
      return next
    })
  }

  async function withAll(action: (products: LowStockProduct[]) => void | Promise<void>) {
    setLoadingAll(true)
    try {
      await action(await fetchAllLowStock(categoryId))
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setLoadingAll(false)
    }
  }

  const restock = (list: LowStockProduct[]) => void navigate('/purchases/new', { state: toDraft(list) })

  const exportExcel = async (list: LowStockProduct[]) => {
    const category = categories.find((option) => option.id === categoryId)
    await downloadWorkbook(t('excel.files.lowStock'), lowStockWorkbook({
      t, products: list, info: [[t('products.columns.category'), category?.label ?? t('products.allCategories')]],
    }), reportMeta)
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select aria-label={t('products.category')} className="h-9 w-52"
          value={categoryId === null ? 'all' : String(categoryId)}
          onValueChange={(value) => {
            setCategoryId(!value || value === 'all' ? null : Number(value))
            setPage(0)
          }}
          options={[
            { value: 'all', label: t('products.allCategories') },
            ...categories.map((category) => ({ value: String(category.id), label: category.label })),
          ]} />
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" className="h-9" disabled={loadingAll || rows.length === 0} onClick={() => void withAll(exportExcel)}>
            <FileSpreadsheet />
            {t('inventory.lowStock.export')}
          </Button>
          <Button variant="outline" className="h-9" disabled={loadingAll || rows.length === 0} onClick={() => void withAll(restock)}>
            <ShoppingBasket />
            {t('inventory.lowStock.restockAll')}
          </Button>
          <Button className="h-9" disabled={selected.size === 0} onClick={() => restock([...selected.values()])}>
            <ShoppingBasket />
            {t('inventory.lowStock.restockSelected', { count: selected.size })}
          </Button>
        </div>
      </div>

      {products.isPending ? (
        <TableSkeleton />
      ) : products.isError ? (
        <ErrorAlert message={errorMessage(products.error)} />
      ) : (
        <Card className="gap-0 py-0">
          {rows.length === 0 ? (
            <EmptyState icon={CircleCheck} text={t('inventory.lowStock.empty')} />
          ) : (
            <Table stickyHeader>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-10 pl-4">
                    <input type="checkbox" className="size-4 accent-primary" checked={allOnPage} onChange={togglePage}
                      aria-label={t('inventory.lowStock.selectPage')} />
                  </TableHead>
                  <TableHead>{t('products.columns.product')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('products.columns.category')}</TableHead>
                  <TableHead className="text-right">{t('inventory.columns.stock')}</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">{t('inventory.columns.min')}</TableHead>
                  <TableHead className="hidden text-right md:table-cell">{t('inventory.columns.shortage')}</TableHead>
                  <TableHead className="pr-4 text-right">{t('inventory.columns.suggested')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((product) => {
                  const stock = product.stock ?? 0
                  const min = product.minStock ?? 0
                  return (
                    <TableRow key={product.productId} data-state={selected.has(product.productId!) ? 'selected' : undefined}>
                      <TableCell className="pl-4">
                        <input type="checkbox" className="size-4 accent-primary" checked={selected.has(product.productId!)}
                          onChange={() => toggle(product)} aria-label={t('inventory.lowStock.select', { name: product.name })} />
                      </TableCell>
                      <TableCell>
                        <span className="grid min-w-0 gap-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate font-medium">{product.name}</span>
                            <StockBadge stock={stock} lowStock />
                          </span>
                          <span className="truncate font-mono text-xs text-muted-foreground">{product.sku}</span>
                          {/* Stock against its minimum: a full bar means the product reached it. */}
                          <span className="h-1.5 w-full max-w-48 rounded-full bg-muted">
                            <span className={cn('block h-full rounded-full', stock === 0 ? 'bg-destructive' : 'bg-amber-500')}
                              style={{ width: min > 0 ? `${Math.min((stock / min) * 100, 100)}%` : 0 }} />
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{categoryName(product.category?.name, t)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{stock}</TableCell>
                      <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">{min}</TableCell>
                      <TableCell className="hidden text-right text-destructive tabular-nums md:table-cell">{product.shortage}</TableCell>
                      <TableCell className="pr-4 text-right font-medium tabular-nums">{suggested(product)}</TableCell>
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
      <p className="text-xs text-muted-foreground">{t('inventory.lowStock.hint')}</p>
    </div>
  )
}
