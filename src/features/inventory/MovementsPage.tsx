import {
  ArrowDownLeft,
  ArrowUpRight,
  FileSpreadsheet,
  History,
  type LucideIcon,
  PackageOpen,
  RefreshCw,
  RotateCcw,
  ShoppingBasket,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { errorMessage } from '@/api/errors'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { EmptyState } from '@/components/EmptyState'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Pagination } from '@/components/Pagination'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/features/cash-drawer/format'
import { categoryName } from '@/features/categories/category-labels'
import { type DayRange, lastDaysRange } from '@/features/dashboard/days'
import { ProductPicker } from '@/features/products/ProductPicker'
import { type Product, useProduct } from '@/features/products/queries'
import type { DraftState } from '@/features/purchases/purchase-draft'
import { PurchaseDetailDialog } from '@/features/purchases/PurchaseDetailDialog'
import { SaleDetailDialog } from '@/features/sales/SaleDetailDialog'
import { dateLocale } from '@/i18n'
import { downloadWorkbook } from '@/lib/excel'
import { useReportMeta } from '@/lib/report-meta'
import { usePageSize } from '@/lib/use-page-size'
import { cn } from '@/lib/utils'

import { AdjustStockDialog } from './AdjustStockDialog'
import { ledgerWorkbook } from './inventory-reports'
import {
  fetchAllMovements,
  MAX_EXPORT_ROWS,
  type Movement,
  type MovementFilters,
  type MovementType,
  MOVEMENT_TYPES,
  useMovements,
} from './queries'
import { StockBadge } from './StockBadge'

const ALL_TYPES = 'all'
const DEFAULT_RANGE_DAYS = 30

const typeIcons: Record<MovementType, LucideIcon> = {
  PURCHASE: ArrowDownLeft,
  SALE: ArrowUpRight,
  SALE_CANCELLATION: RotateCcw,
  ADJUSTMENT: SlidersHorizontal,
}

// Stock ledger (kardex) of one product: every purchase, sale, cancellation and adjustment, with the
// stock it left and who recorded it. The product is in the URL, so a link opens its ledger.
export function MovementsPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const productId = Number(params.get('productId')) || null
  const product = useProduct(productId)
  const [type, setType] = useState<MovementType | null>(null)
  const [range, setRange] = useState<DayRange | null>(null)
  const [asOf, setAsOf] = useState(() => new Date().toISOString())
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = usePageSize('ledger')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [adjusting, setAdjusting] = useState<Product | null>(null)
  const [purchaseId, setPurchaseId] = useState<number | null>(null)
  const [saleId, setSaleId] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)
  const reportMeta = useReportMeta()

  const filters: MovementFilters | null = productId === null ? null : { productId, type, range, asOf }
  const movements = useMovements(filters, page, pageSize)
  const when = new Intl.DateTimeFormat(dateLocale(i18n.language), { dateStyle: 'medium', timeStyle: 'short' })

  // Any filter change starts again from the newest movement.
  function refilter(change: () => void) {
    change()
    setAsOf(new Date().toISOString())
    setPage(0)
  }

  function pickProduct(next: Product | null) {
    refilter(() => setParams(next ? { productId: String(next.id) } : {}))
  }

  function reference(movement: Movement): string {
    switch (movement.type) {
      case 'PURCHASE':
        return t('inventory.ledger.purchaseRef', { id: movement.purchaseId })
      case 'SALE':
        return t('inventory.ledger.saleRef', { number: movement.saleNumber })
      case 'SALE_CANCELLATION':
        return t('inventory.ledger.cancellationRef', { number: movement.saleNumber })
      default:
        return movement.reason ?? ''
    }
  }

  async function exportExcel() {
    if (!filters || !product.data) {
      return
    }
    setExporting(true)
    try {
      const { movements: all, truncated } = await fetchAllMovements(filters)
      if (truncated) {
        toast.warning(t('inventory.ledger.exportTruncated', { count: MAX_EXPORT_ROWS }))
      }
      const period = range
        ? t('excel.period', { from: formatDate(range.from, i18n.language), to: formatDate(range.to, i18n.language) })
        : t('excel.allDates')
      await downloadWorkbook(`${t('excel.files.ledger')}_${product.data.sku}`, ledgerWorkbook({
        t, product: product.data, movements: all, truncated, period, reference,
        info: [[t('inventory.ledger.columns.type'), type ? t(`inventory.types.${type}`) : t('inventory.ledger.allTypes')]],
      }), reportMeta)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setExporting(false)
    }
  }

  const rows = movements.data?.content ?? []

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="grid gap-4">
          {product.data ? (
            <div className="flex flex-wrap items-center gap-4">
              <div className="grid min-w-0 flex-1 gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-semibold">{product.data.name}</h2>
                  {product.data.active
                    ? <StockBadge stock={product.data.stock ?? 0} lowStock={!!product.data.lowStock} />
                    : <span className="text-xs text-muted-foreground">{t('inventory.status.inactive')}</span>}
                </div>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {[product.data.sku, product.data.barcode, categoryName(product.data.category?.name, t)].filter(Boolean).join(' · ')}
                </p>
              </div>
              <dl className="flex gap-6 text-center">
                <div>
                  <dt className="text-xs text-muted-foreground">{t('inventory.columns.stock')}</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{product.data.stock}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t('inventory.columns.min')}</dt>
                  <dd className="text-2xl font-semibold text-muted-foreground tabular-nums">{product.data.minStock}</dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setAdjusting(product.data)}>
                  <PackageOpen />
                  {t('inventory.adjust.title')}
                </Button>
                {product.data.active && (
                  <Button variant="outline" onClick={() => {
                    const state: DraftState = {
                      lines: [{ productId: product.data.id!, sku: product.data.sku!, name: product.data.name!,
                        stock: product.data.stock, salePrice: product.data.salePrice }],
                    }
                    void navigate('/purchases/new', { state })
                  }}>
                    <ShoppingBasket />
                    {t('inventory.ledger.buy')}
                  </Button>
                )}
                <Button variant="ghost" size="icon" aria-label={t('inventory.ledger.changeProduct')} onClick={() => pickProduct(null)}>
                  <X />
                </Button>
              </div>
            </div>
          ) : product.isError ? (
            <ErrorAlert message={errorMessage(product.error)} />
          ) : productId !== null ? (
            <div className="h-14 animate-pulse rounded-lg bg-muted/60" />
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="ledger-product">{t('inventory.ledger.chooseProduct')}</Label>
              <ProductPicker id="ledger-product" active={!includeInactive} autoFocus onPick={pickProduct} />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" className="size-3.5 accent-primary" checked={includeInactive}
                  onChange={(event) => setIncludeInactive(event.target.checked)} />
                {t('inventory.ledger.searchInactive')}
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      {productId === null ? (
        <Card><EmptyState icon={History} text={t('inventory.ledger.intro')} /></Card>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-2">
                <Label htmlFor="ledger-type">{t('inventory.ledger.columns.type')}</Label>
                <Select id="ledger-type" className="h-9 w-52" value={type ?? ALL_TYPES}
                  onValueChange={(value) => refilter(() => setType(!value || value === ALL_TYPES ? null : value as MovementType))}
                  options={[
                    { value: ALL_TYPES, label: t('inventory.ledger.allTypes') },
                    ...MOVEMENT_TYPES.map((option) => ({ value: option, label: t(`inventory.types.${option}`) })),
                  ]} />
              </div>
              {range ? (
                <>
                  <DateRangeFilter value={range} onChange={(next) => refilter(() => setRange(next))} />
                  <Button variant="ghost" className="h-9" onClick={() => refilter(() => setRange(null))}>
                    {t('inventory.ledger.allDates')}
                  </Button>
                </>
              ) : (
                <Button variant="outline" className="h-9" onClick={() => refilter(() => setRange(lastDaysRange(DEFAULT_RANGE_DAYS)))}>
                  {t('inventory.ledger.filterDates')}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="h-9" onClick={() => refilter(() => {})} aria-label={t('inventory.ledger.refresh')}>
                <RefreshCw className={cn(movements.isFetching && 'animate-spin')} />
              </Button>
              <Button variant="outline" className="h-9" disabled={exporting || rows.length === 0} onClick={() => void exportExcel()}>
                <FileSpreadsheet />
                {t('inventory.ledger.export')}
              </Button>
            </div>
          </div>

          {movements.isError ? (
            <ErrorAlert message={errorMessage(movements.error)} />
          ) : (
            <Card className="gap-0 py-0">
              {movements.isPending ? (
                <div className="m-4 h-40 animate-pulse rounded-lg bg-muted/60" />
              ) : rows.length === 0 ? (
                <EmptyState icon={History} text={t('inventory.ledger.empty')} />
              ) : (
                <Table stickyHeader>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="pl-4">{t('inventory.ledger.columns.date')}</TableHead>
                      <TableHead>{t('inventory.ledger.columns.type')}</TableHead>
                      <TableHead className="hidden md:table-cell">{t('inventory.ledger.columns.reference')}</TableHead>
                      <TableHead className="text-right">{t('inventory.ledger.columns.quantity')}</TableHead>
                      <TableHead className="text-right">{t('inventory.ledger.columns.stock')}</TableHead>
                      <TableHead className="hidden pr-4 lg:table-cell">{t('inventory.ledger.columns.recordedBy')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((movement) => {
                      const Icon = typeIcons[movement.type!]
                      const quantity = movement.quantity ?? 0
                      const opens = movement.type === 'PURCHASE'
                        ? () => setPurchaseId(movement.purchaseId!)
                        : movement.saleId ? () => setSaleId(movement.saleId!) : null
                      return (
                        <TableRow key={movement.id}>
                          <TableCell className="pl-4 whitespace-nowrap">{when.format(new Date(movement.movementDate!))}</TableCell>
                          <TableCell>
                            <span className="flex items-center gap-2">
                              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                                <Icon className="size-3.5 text-muted-foreground" />
                              </span>
                              <span className="grid">
                                <span className="text-sm">{t(`inventory.types.${movement.type!}`)}</span>
                                {/* Narrow screens hide the reference column: it goes under the type. */}
                                <span className="max-w-48 truncate text-xs text-muted-foreground md:hidden">{reference(movement)}</span>
                              </span>
                            </span>
                          </TableCell>
                          <TableCell className="hidden max-w-72 md:table-cell">
                            {opens ? (
                              <button type="button" onClick={opens} className="text-left underline-offset-4 hover:underline">
                                {reference(movement)}
                              </button>
                            ) : (
                              <span className="block truncate text-muted-foreground" title={movement.reason}>{reference(movement)}</span>
                            )}
                          </TableCell>
                          <TableCell className={cn('text-right font-medium tabular-nums',
                            quantity > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive')}>
                            {quantity > 0 ? `+${quantity}` : `−${Math.abs(quantity)}`}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{movement.resultingStock}</TableCell>
                          <TableCell className="hidden pr-4 text-muted-foreground lg:table-cell">{movement.recordedBy?.name}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
              {movements.data && (
                <Pagination page={page} pageSize={pageSize} total={movements.data.page?.totalElements ?? 0}
                  loading={movements.isPlaceholderData} onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(0)
            }} />
              )}
            </Card>
          )}
        </>
      )}

      <AdjustStockDialog product={adjusting} onOpenChange={(open) => {
        if (!open) {
          setAdjusting(null)
          // The new adjustment goes on top.
          setAsOf(new Date().toISOString())
          setPage(0)
        }
      }} />
      <PurchaseDetailDialog purchaseId={purchaseId} onClose={() => setPurchaseId(null)} />
      <SaleDetailDialog saleId={saleId} canCancel={false} onClose={() => setSaleId(null)} />
    </div>
  )
}
