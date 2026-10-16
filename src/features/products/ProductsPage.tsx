import { Package, PackagePlus, Pencil, Search, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorMessage } from '@/api/errors'
import { managesStore, useUser } from '@/auth/auth-context'
import { ErrorAlert } from '@/components/ErrorAlert'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { Pagination } from '@/components/Pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { categoryName } from '@/features/categories/category-labels'
import { useCategories } from '@/features/categories/queries'
import { useLabeledCategories } from '@/features/categories/use-labeled-categories'
import { formatMoney, withTax } from '@/lib/money'
import { cn } from '@/lib/utils'

import { CreateProductDialog, EditProductDialog } from './ProductDialogs'
import { DeleteProductDialog } from './DeleteProductDialog'
import { ScanBar } from './ScanBar'
import { formatTaxRate } from './tax-rate'
import { PAGE_SIZE, type Product, type ProductFilters, useProducts } from './queries'

// Waits for a pause in typing before searching, so each keystroke isn't a request.
const SEARCH_DELAY_MS = 300

export function ProductsPage() {
  const { t } = useTranslation()
  const { role } = useUser()
  const canEdit = managesStore(role)
  const [searchText, setSearchText] = useState('')
  const [filters, setFilters] = useState<ProductFilters>({ search: '', categoryId: null, active: true, lowStock: false })
  const [page, setPage] = useState(0)
  const [creating, setCreating] = useState(false)
  // Barcode a scan didn't find, to start the new product with it.
  const [newBarcode, setNewBarcode] = useState<string | undefined>()
  const [editing, setEditing] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const products = useProducts(filters, page)
  const categories = useLabeledCategories(useCategories().data)

  // Any filter change goes back to the first page.
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

  const filtered = filters.search !== '' || filters.categoryId !== null || !filters.active || filters.lowStock

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('products.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('products.description')}</p>
      </div>

      {canEdit && (
        <ScanBar onFound={setEditing} onMissing={(barcode) => {
          setNewBarcode(barcode)
          setCreating(true)
        }} />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" value={searchText} onChange={(event) => setSearchText(event.target.value)}
            placeholder={t('products.searchPlaceholder')} aria-label={t('products.searchLabel')} className="h-9 pl-8" />
        </div>
        <Select aria-label={t('products.category')} className="h-9 w-52"
          value={filters.categoryId === null ? 'all' : String(filters.categoryId)}
          onValueChange={(value) => changeFilters({ categoryId: value === 'all' ? null : Number(value) })}
          options={[
            { value: 'all', label: t('products.allCategories') },
            ...categories.map((category) => ({ value: String(category.id), label: category.label })),
          ]} />
        <Select aria-label={t('products.status')} className="h-9 w-36"
          value={filters.active ? 'active' : 'inactive'}
          onValueChange={(value) => changeFilters({ active: value === 'active' })}
          options={[
            { value: 'active', label: t('products.activeOnes') },
            { value: 'inactive', label: t('products.inactiveOnes') },
          ]} />
        <label className="flex h-9 items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={filters.lowStock}
            onChange={(event) => changeFilters({ lowStock: event.target.checked })} />
          {t('products.lowStockOnly')}
        </label>
        {canEdit && (
          <Button className="ml-auto" onClick={() => {
            setNewBarcode(undefined)
            setCreating(true)
          }}>
            <PackagePlus />
            {t('products.new')}
          </Button>
        )}
      </div>

      {products.isPending ? (
        <FullPageSpinner />
      ) : products.isError ? (
        <ErrorAlert message={errorMessage(products.error)} />
      ) : (
        <Card className="gap-0 py-0">
          <ProductsTable products={products.data.content ?? []} filtered={filtered} canEdit={canEdit}
            onEdit={setEditing} onDelete={setDeleting} onCreate={() => {
              setNewBarcode(undefined)
              setCreating(true)
            }} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={products.data.page?.totalElements ?? 0}
            loading={products.isPlaceholderData} onPageChange={setPage} />
        </Card>
      )}

      {canEdit && (
        <>
          <CreateProductDialog open={creating} onOpenChange={setCreating} categories={categories} barcode={newBarcode} />
          <EditProductDialog product={editing} categories={categories}
            onOpenChange={(open) => !open && setEditing(null)} />
          <DeleteProductDialog product={deleting} onOpenChange={(open) => !open && setDeleting(null)} />
        </>
      )}
    </div>
  )
}

function ProductsTable({ products, filtered, canEdit, onEdit, onDelete, onCreate }: {
  products: Product[]
  filtered: boolean
  canEdit: boolean
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
  onCreate: () => void
}) {
  const { t, i18n } = useTranslation()

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Package className="size-6 text-muted-foreground" />
        </span>
        <p className="text-sm text-muted-foreground">{filtered ? t('products.noMatches') : t('products.empty')}</p>
        {canEdit && !filtered && <Button variant="outline" onClick={onCreate}>{t('products.new')}</Button>}
      </div>
    )
  }
  return (
    <Table>
      <TableHeader className="bg-muted/50">
        <TableRow>
          <TableHead className="pl-4">{t('products.columns.product')}</TableHead>
          <TableHead className="hidden lg:table-cell">{t('products.columns.sku')}</TableHead>
          <TableHead className="hidden xl:table-cell">{t('products.columns.barcode')}</TableHead>
          <TableHead className="hidden xl:table-cell">{t('products.columns.category')}</TableHead>
          <TableHead className="hidden text-right md:table-cell">{t('products.columns.priceWithoutVat')}</TableHead>
          <TableHead className="hidden text-right md:table-cell">{t('products.columns.vat')}</TableHead>
          <TableHead className="text-right">{t('products.columns.priceWithVat')}</TableHead>
          <TableHead className={cn('text-right', !canEdit && 'pr-4')}>{t('products.columns.stock')}</TableHead>
          {canEdit && (
            <TableHead className="w-24 pr-4"><span className="sr-only">{t('products.columns.actions')}</span></TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.id} className={cn(!product.active && 'text-muted-foreground')}>
            <TableCell className="pl-4">
              <div className="flex items-center gap-3">
                {/* Keyed by URL so a fixed link gets a fresh try. */}
                <ProductThumbnail key={product.imageUrl} url={product.imageUrl} />
                <span className="grid min-w-0">
                  <span className="truncate font-medium text-foreground">{product.name}</span>
                  {/* Narrow screens hide the code columns: the codes go under the name instead. */}
                  <span className="truncate text-xs text-muted-foreground xl:hidden">
                    {[product.sku, product.barcode].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </div>
            </TableCell>
            <TableCell className="hidden font-mono text-xs lg:table-cell">{product.sku}</TableCell>
            <TableCell className="hidden font-mono text-xs xl:table-cell">
              {product.barcode ?? <span className="text-muted-foreground">—</span>}
            </TableCell>
            <TableCell className="hidden xl:table-cell">{categoryName(product.category?.name, t)}</TableCell>
            <TableCell className="hidden text-right tabular-nums md:table-cell">{formatMoney(product.salePrice!)}</TableCell>
            <TableCell className="hidden text-right tabular-nums md:table-cell">
              {formatTaxRate(product.taxRate!, i18n.language)}
            </TableCell>
            <TableCell className="text-right font-medium text-foreground tabular-nums">
              {formatMoney(withTax(product.salePrice!, product.taxRate!))}
            </TableCell>
            <TableCell className={cn('text-right', !canEdit && 'pr-4')}>
              <span className="grid justify-items-end">
                <span className="flex items-center gap-1.5 font-medium text-foreground tabular-nums">
                  {product.lowStock && product.active && <Badge variant="destructive">{t('products.lowStock')}</Badge>}
                  {product.stock}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t('products.minStock', { count: product.minStock })}
                </span>
              </span>
            </TableCell>
            {canEdit && (
              <TableCell className="pr-4 text-right whitespace-nowrap">
                <Button variant="ghost" size="icon" aria-label={t('products.edit', { name: product.name })}
                  title={t('products.editTitle')} onClick={() => onEdit(product)}>
                  <Pencil />
                </Button>
                <Button variant="ghost" size="icon" aria-label={t('products.delete.open', { name: product.name })}
                  title={t('products.delete.confirm')} onClick={() => onDelete(product)}
                  className="text-muted-foreground hover:text-destructive">
                  <Trash2 />
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// The product's photo, or a box icon when it has none or the link is broken.
function ProductThumbnail({ url }: { url?: string }) {
  const [broken, setBroken] = useState(false)

  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
      {url && !broken
        ? <img src={url} alt="" loading="lazy" className="size-full object-cover" onError={() => setBroken(true)} />
        : <Package className="size-5 text-muted-foreground" />}
    </span>
  )
}
