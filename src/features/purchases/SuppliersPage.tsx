import { Pencil, Plus, ShoppingBasket, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { errorMessage } from '@/api/errors'
import { EmptyState } from '@/components/EmptyState'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Highlight } from '@/components/Highlight'
import { Pagination } from '@/components/Pagination'
import { SearchInput } from '@/components/SearchInput'
import { SortableHead } from '@/components/SortableHead'
import { TableSkeleton } from '@/components/TableSkeleton'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { initials } from '@/lib/initials'
import { type SortState } from '@/lib/sort'
import { usePageSize } from '@/lib/use-page-size'
import { cn } from '@/lib/utils'

import { type Supplier, type SupplierFilters, useSuppliers } from './queries'
import { SupplierDialog } from './SupplierDialog'

// Waits for a pause in typing before searching, so each keystroke isn't a request.
const SEARCH_DELAY_MS = 300

// Suppliers can't be deleted (their purchases keep them): inactive ones leave the purchase picker.
export function SuppliersPage() {
  const { t } = useTranslation()
  const [searchText, setSearchText] = useState('')
  const [filters, setFilters] = useState<SupplierFilters>({ search: '', active: true })
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = usePageSize('suppliers')
  // Column order; null keeps the list's default.
  const [sort, setSort] = useState<SortState | null>(null)
  // null: closed; 'new': creating; a supplier: editing it.
  const [open, setOpen] = useState<Supplier | 'new' | null>(null)
  const suppliers = useSuppliers(filters, page, pageSize, sort)
  const changeSort = (next: SortState | null) => {
    setSort(next)
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

  const filtered = filters.search !== '' || !filters.active
  const rows = suppliers.data?.content ?? []

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput wrapperClassName="min-w-56 flex-1" value={searchText} onValueChange={setSearchText}
          loading={searchText.trim() !== filters.search || (suppliers.isFetching && suppliers.isPlaceholderData)}
          placeholder={t('suppliers.searchPlaceholder')} aria-label={t('suppliers.searchLabel')} />
        <Select aria-label={t('suppliers.status')} className="h-9 w-36"
          value={filters.active ? 'active' : 'inactive'}
          onValueChange={(value) => {
            setFilters((current) => ({ ...current, active: value === 'active' }))
            setPage(0)
          }}
          options={[
            { value: 'active', label: t('suppliers.activeOnes') },
            { value: 'inactive', label: t('suppliers.inactiveOnes') },
          ]} />
        <Button className="h-9" onClick={() => setOpen('new')}>
          <Plus />
          {t('suppliers.new')}
        </Button>
      </div>

      {suppliers.isPending ? (
        <TableSkeleton />
      ) : suppliers.isError ? (
        <ErrorAlert message={errorMessage(suppliers.error)} />
      ) : (
        <Card className="gap-0 py-0">
          {rows.length === 0 ? (
            <EmptyState icon={Truck} text={filtered ? t('suppliers.noMatches') : t('suppliers.empty')}>
              {!filtered && <Button variant="outline" onClick={() => setOpen('new')}>{t('suppliers.new')}</Button>}
            </EmptyState>
          ) : (
            <Table stickyHeader>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <SortableHead field="name" sort={sort} onSort={changeSort} className="pl-4">{t('suppliers.columns.name')}</SortableHead>
                  <SortableHead field="taxId" sort={sort} onSort={changeSort} className="hidden sm:table-cell">{t('suppliers.columns.taxId')}</SortableHead>
                  <SortableHead field="phone" sort={sort} onSort={changeSort} className="hidden md:table-cell">{t('suppliers.columns.phone')}</SortableHead>
                  <TableHead className="hidden xl:table-cell">{t('suppliers.columns.address')}</TableHead>
                  <TableHead>{t('suppliers.columns.status')}</TableHead>
                  <TableHead className="w-24 pr-4"><span className="sr-only">{t('suppliers.columns.actions')}</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((supplier) => (
                  <TableRow key={supplier.id} className={cn(!supplier.active && 'text-muted-foreground')}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                          {initials(supplier.name!)}
                        </span>
                        <span className="grid min-w-0">
                          <span className="truncate font-medium text-foreground"><Highlight text={supplier.name} query={filters.search} /></span>
                          <span className="truncate text-xs text-muted-foreground">
                            {supplier.taxId && <span className="font-mono sm:hidden"><Highlight text={supplier.taxId} query={filters.search} />{supplier.email && ' · '}</span>}
                            {supplier.email}
                          </span>
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs sm:table-cell">
                      {supplier.taxId ? <Highlight text={supplier.taxId} query={filters.search} /> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">
                      {supplier.phone ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="hidden max-w-64 truncate xl:table-cell" title={supplier.address}>
                      {supplier.address ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <span className={cn('size-2 rounded-full', supplier.active ? 'bg-emerald-500' : 'bg-muted-foreground/50')} />
                        {supplier.active ? t('suppliers.active') : t('suppliers.inactive')}
                      </span>
                    </TableCell>
                    <TableCell className="pr-4 text-right whitespace-nowrap">
                      {supplier.active && (
                        <Link to="/purchases/new" state={{ supplier: { id: supplier.id, name: supplier.name, taxId: supplier.taxId } }}
                          aria-label={t('suppliers.buyFrom', { name: supplier.name })} title={t('suppliers.buyFromTitle')}
                          className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
                          <ShoppingBasket />
                        </Link>
                      )}
                      <Button variant="ghost" size="icon" aria-label={t('suppliers.edit', { name: supplier.name })}
                        title={t('suppliers.editTitle')} onClick={() => setOpen(supplier)}>
                        <Pencil />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <Pagination page={page} pageSize={pageSize} total={suppliers.data.page?.totalElements ?? 0}
            loading={suppliers.isPlaceholderData} onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(0)
            }} />
        </Card>
      )}

      <SupplierDialog open={open} onOpenChange={(isOpen) => !isOpen && setOpen(null)} />
    </div>
  )
}
