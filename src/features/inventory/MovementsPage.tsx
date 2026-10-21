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
import { categoryName } from '@/features/categories/category-labels'
import { ProductPicker } from '@/features/products/ProductPicker'
import { type Product, useProduct } from '@/features/products/queries'
import { PurchaseDetailDialog } from '@/features/purchases/PurchaseDetailDialog'
import type { DraftState } from '@/features/purchases/purchase-draft'
import { SaleDetailDialog } from '@/features/sales/SaleDetailDialog'
import { formatDate, formatDateTime } from '@/lib/date-format'
import { lastDaysRange } from '@/lib/days'
import { downloadWorkbook } from '@/lib/excel'
import { useReportMeta } from '@/lib/report-meta'
import { usePageSize } from '@/lib/use-page-size'
import { useToday } from '@/lib/use-today'
import { cn } from '@/lib/utils'

import { AdjustStockDialog } from './AdjustStockDialog'
import { ledgerWorkbook, storeLedgerWorkbook } from './inventory-reports'
import {
  DEFAULT_RANGE_DAYS,
  MAX_STORE_WIDE_DAYS,
  MOVEMENT_TYPES,
  movementParams,
  type MovementParams,
  readMovementParams,
} from './movement-params'
import { fetchAllMovements, MAX_EXPORT_ROWS, type Movement, type MovementFilters, type MovementType, useMovements } from './queries'
import { StockBadge } from './StockBadge'

const ALL_TYPES = 'all'

const typeIcons: Record<MovementType, LucideIcon> = {
  PURCHASE: ArrowDownLeft,
  SALE: ArrowUpRight,
  SALE_CANCELLATION: RotateCcw,
  ADJUSTMENT: SlidersHorizontal,
}

/**
 * Stock ledger (kardex) of one product: every purchase, sale, cancellation and adjustment, with the
 * stock it left and who recorded it. Without a product, one type of movement across the store (e.g.
 * today's adjustments). The filters are in the URL, so a link opens the ledger already filtered.
 */
export function MovementsPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const today = useToday()
  const [params, setParams] = useSearchParams()
  const { productId, type, storeWide, range, chosen } = readMovementParams(params, today)
  const product = useProduct(productId)
  const paramsKey = params.toString()
  // The upper bound for the URL's filters: taken again for every new set (and on refresh) so newer
  // movements show up, kept in between so the pages don't shift. When the browser's history or the
  // section's tabs change the URL, no handler takes one: no bound (the newest) until the next action.
  const [snapshot, setSnapshot] = useState(() => ({ paramsKey, asOf: new Date().toISOString() }))
  const asOf = snapshot.paramsKey === paramsKey ? snapshot.asOf : null
  const [page, setPage] = useState(0)
  const [shownParams, setShownParams] = useState(paramsKey)
  if (paramsKey !== shownParams) {
    setShownParams(paramsKey)
    setPage(0)
  }
  const [pageSize, setPageSize] = usePageSize('ledger')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [adjusting, setAdjusting] = useState<Product | null>(null)
  const [purchaseId, setPurchaseId] = useState<number | null>(null)
  const [saleId, setSaleId] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)
  const reportMeta = useReportMeta()

  const filters: MovementFilters | null =
    productId !== null || storeWide ? { productId, type, range, asOf } : null
  const movements = useMovements(filters, page, pageSize)

  // A new URL starts again from the newest movement, on the first page.
  function refilter(change: Partial<MovementParams>) {
    const next = movementParams({ ...chosen, ...change })
    setSnapshot({ paramsKey: next.toString(), asOf: new Date().toISOString() })
    setParams(next)
  }

  // A fresh asOf, not a refetch: the old bound would keep hiding newer movements.
  function showNewest() {
    setSnapshot({ paramsKey, asOf: new Date().toISOString() })
    setPage(0)
  }

  function pickProduct(next: Product | null) {
    refilter({ productId: next?.id ?? null })
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
    if (!filters || (!storeWide && !product.data)) {
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
      if (storeWide && type && range) {
        await downloadWorkbook(`${t('excel.files.storeLedger')}_${type.toLowerCase()}_${range.from}_${range.to}`,
          storeLedgerWorkbook({ t, type, movements: all, truncated, period, reference }), reportMeta)
      } else if (product.data) {
        await downloadWorkbook(`${t('excel.files.ledger')}_${product.data.sku}`, ledgerWorkbook({
          t, product: product.data, movements: all, truncated, period, reference,
          info: [[t('inventory.ledger.columns.type'), type ? t(`inventory.types.${type}`) : t('inventory.ledger.allTypes')]],
        }), reportMeta)
      }
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
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1"><ErrorAlert message={errorMessage(product.error)} /></div>
              <Button variant="ghost" size="icon" aria-label={t('inventory.ledger.changeProduct')} onClick={() => pickProduct(null)}>
                <X />
              </Button>
            </div>
          ) : productId !== null ? (
            <div className="h-14 animate-pulse rounded-lg bg-muted/60" />
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="ledger-product">{t(storeWide ? 'inventory.ledger.narrowToProduct' : 'inventory.ledger.chooseProduct')}</Label>
              <ProductPicker id="ledger-product" active={!includeInactive} autoFocus={!storeWide} onPick={pickProduct} />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" className="size-3.5 accent-primary" checked={includeInactive}
                  onChange={(event) => setIncludeInactive(event.target.checked)} />
                {t('inventory.ledger.searchInactive')}
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      {filters === null ? (
        <Card>
          <EmptyState icon={History} text={t('inventory.ledger.intro')}>
            <Select aria-label={t('inventory.ledger.storeWide')} className="h-9 w-64" value=""
              placeholder={t('inventory.ledger.storeWide')}
              onValueChange={(value) => value && refilter({ type: value as MovementType })}
              options={MOVEMENT_TYPES.map((option) => ({ value: option, label: t(`inventory.types.${option}`) }))} />
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-2">
                <Label htmlFor="ledger-type">{t('inventory.ledger.columns.type')}</Label>
                {/* Store-wide needs a type: "all" only exists for a product's ledger. */}
                <Select id="ledger-type" className="h-9 w-52" value={type ?? ALL_TYPES}
                  onValueChange={(value) => refilter({ type: !value || value === ALL_TYPES ? null : value as MovementType })}
                  options={[
                    ...(storeWide ? [] : [{ value: ALL_TYPES, label: t('inventory.ledger.allTypes') }]),
                    ...MOVEMENT_TYPES.map((option) => ({ value: option, label: t(`inventory.types.${option}`) })),
                  ]} />
              </div>
              {range ? (
                <>
                  <DateRangeFilter value={range} maxDays={storeWide ? MAX_STORE_WIDE_DAYS : undefined}
                    onChange={(next) => refilter({ range: next })} />
                  {!storeWide && (
                    <Button variant="ghost" className="h-9" onClick={() => refilter({ range: null })}>
                      {t('inventory.ledger.allDates')}
                    </Button>
                  )}
                </>
              ) : (
                <Button variant="outline" className="h-9" onClick={() => refilter({ range: lastDaysRange(DEFAULT_RANGE_DAYS, today) })}>
                  {t('inventory.ledger.filterDates')}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="h-9" onClick={showNewest} aria-label={t('inventory.ledger.refresh')}>
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
                      {storeWide && <TableHead>{t('inventory.ledger.columns.product')}</TableHead>}
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
                          <TableCell className="pl-4 whitespace-nowrap">{formatDateTime(movement.movementDate, i18n.language)}</TableCell>
                          {storeWide && (
                            <TableCell className="max-w-56">
                              <button type="button" onClick={() => refilter({ productId: movement.productId ?? null })}
                                className="block max-w-full truncate text-left font-medium underline-offset-4 hover:underline"
                                title={t('inventory.ledger.openFor', { name: movement.productName })}>
                                {movement.productName}
                              </button>
                            </TableCell>
                          )}
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
          showNewest()
        }
      }} />
      <PurchaseDetailDialog purchaseId={purchaseId} onClose={() => setPurchaseId(null)} />
      <SaleDetailDialog saleId={saleId} canCancel={false} onClose={() => setSaleId(null)} />
    </div>
  )
}
