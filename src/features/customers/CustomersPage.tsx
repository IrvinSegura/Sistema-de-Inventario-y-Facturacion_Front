import { Contact, Pencil, ReceiptText, Trash2, TriangleAlert, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorMessage } from '@/api/errors'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Highlight } from '@/components/Highlight'
import { Pagination } from '@/components/Pagination'
import { SearchInput } from '@/components/SearchInput'
import { SortableHead } from '@/components/SortableHead'
import { TableSkeleton } from '@/components/TableSkeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { initials } from '@/lib/initials'
import { type SortState } from '@/lib/sort'
import { usePageSize } from '@/lib/use-page-size'
import { cn } from '@/lib/utils'

import { CustomerDialog } from './CustomerDialog'
import { DeleteCustomerDialog } from './DeleteCustomerDialog'
import { type Customer, type CustomerFilters, useCustomers } from './queries'
import { isInvoiceable } from './tax-regimes'

// Waits for a pause in typing before searching, so each keystroke isn't a request.
const SEARCH_DELAY_MS = 300

/** Admins and supervisors only (the route and the menu); the walk-in customer is read-only. */
export function CustomersPage() {
  const { t } = useTranslation()
  const [searchText, setSearchText] = useState('')
  const [filters, setFilters] = useState<CustomerFilters>({ search: '', active: true })
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = usePageSize('customers')
  // Column order; null keeps the list's default.
  const [sort, setSort] = useState<SortState | null>(null)
  // null: closed; 'new': creating; a customer: editing it.
  const [open, setOpen] = useState<Customer | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Customer | null>(null)
  const customers = useCustomers(filters, page, pageSize, sort)
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

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t('customers.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('customers.description')}</p>
        </div>
        <Button size="lg" onClick={() => setOpen('new')}>
          <UserPlus />
          {t('customers.new')}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput wrapperClassName="min-w-56 flex-1" value={searchText} onValueChange={setSearchText}
          loading={searchText.trim() !== filters.search || (customers.isFetching && customers.isPlaceholderData)}
          placeholder={t('customers.searchPlaceholder')} aria-label={t('customers.searchLabel')} />
        <Select aria-label={t('customers.status')} className="h-9 w-36"
          value={filters.active ? 'active' : 'inactive'}
          onValueChange={(value) => {
            setFilters((current) => ({ ...current, active: value === 'active' }))
            setPage(0)
          }}
          options={[
            { value: 'active', label: t('customers.activeOnes') },
            { value: 'inactive', label: t('customers.inactiveOnes') },
          ]} />
      </div>

      {customers.isPending ? (
        <TableSkeleton />
      ) : customers.isError ? (
        <ErrorAlert message={errorMessage(customers.error)} />
      ) : (
        <Card className="gap-0 py-0">
          <CustomersTable customers={customers.data.content ?? []} sort={sort} onSort={changeSort} filtered={filtered} search={filters.search}
            onEdit={setOpen} onDelete={setDeleting} onCreate={() => setOpen('new')} />
          <Pagination page={page} pageSize={pageSize} total={customers.data.page?.totalElements ?? 0}
            loading={customers.isPlaceholderData} onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(0)
            }} />
        </Card>
      )}

      <CustomerDialog open={open} onOpenChange={(isOpen) => !isOpen && setOpen(null)} />
      <DeleteCustomerDialog customer={deleting} onOpenChange={(isOpen) => !isOpen && setDeleting(null)} />
    </div>
  )
}

function CustomersTable({ customers, filtered, search, onEdit, onDelete, onCreate, sort, onSort }: {
  sort: SortState | null
  onSort: (sort: SortState | null) => void
  customers: Customer[]
  filtered: boolean
  /** Highlighted in names and tax IDs. */
  search: string
  onEdit: (customer: Customer) => void
  onDelete: (customer: Customer) => void
  onCreate: () => void
}) {
  const { t } = useTranslation()

  if (customers.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Contact className="size-6 text-muted-foreground" />
        </span>
        <p className="text-sm text-muted-foreground">{filtered ? t('customers.noMatches') : t('customers.empty')}</p>
        {!filtered && <Button variant="outline" onClick={onCreate}>{t('customers.new')}</Button>}
      </div>
    )
  }
  return (
    <Table stickyHeader>
      <TableHeader className="bg-muted/50">
        <TableRow>
          <SortableHead field="name" sort={sort} onSort={onSort} className="pl-4">{t('customers.columns.name')}</SortableHead>
          <SortableHead field="taxId" sort={sort} onSort={onSort} className="hidden sm:table-cell">{t('customers.columns.taxId')}</SortableHead>
          <SortableHead field="phone" sort={sort} onSort={onSort} className="hidden md:table-cell">{t('customers.columns.phone')}</SortableHead>
          <TableHead className="hidden xl:table-cell">{t('customers.columns.address')}</TableHead>
          <TableHead>{t('customers.columns.status')}</TableHead>
          <TableHead className="w-24 pr-4"><span className="sr-only">{t('customers.columns.actions')}</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {customers.map((customer) => (
          <TableRow key={customer.id} className={cn(!customer.active && 'text-muted-foreground')}>
            <TableCell className="pl-4">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                  {initials(customer.name!)}
                </span>
                <span className="grid min-w-0">
                  <span className="flex min-w-0 items-center gap-1.5 font-medium text-foreground">
                    <span className="truncate"><Highlight text={customer.name} query={search} /></span>
                    {customer.walkIn && <Badge variant="secondary">{t('customers.walkIn')}</Badge>}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {/* Narrow screens hide the tax ID column: it goes under the name instead. */}
                    {customer.taxId && <span className="font-mono sm:hidden"><Highlight text={customer.taxId} query={search} />{customer.email && ' · '}</span>}
                    {customer.email}
                  </span>
                  {customer.taxId && !customer.walkIn && <InvoiceStatus customer={customer} className="sm:hidden" />}
                </span>
              </div>
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              {customer.taxId ? (
                <span className="grid gap-0.5">
                  <span className="font-mono text-xs"><Highlight text={customer.taxId} query={search} /></span>
                  {!customer.walkIn && <InvoiceStatus customer={customer} />}
                </span>
              ) : <span className="text-muted-foreground">—</span>}
            </TableCell>
            <TableCell className="hidden tabular-nums md:table-cell">
              {customer.phone ?? <span className="text-muted-foreground">—</span>}
            </TableCell>
            <TableCell className="hidden max-w-64 truncate xl:table-cell" title={customer.address}>
              {customer.address ?? <span className="text-muted-foreground">—</span>}
            </TableCell>
            <TableCell>
              <span className="inline-flex items-center gap-1.5 text-sm">
                <span className={cn('size-2 rounded-full', customer.active ? 'bg-emerald-500' : 'bg-muted-foreground/50')} />
                {customer.active ? t('customers.active') : t('customers.inactive')}
              </span>
            </TableCell>
            <TableCell className="pr-4 text-right whitespace-nowrap">
              {/* Sales without a customer fall back to the walk-in one, so the API keeps it as seeded. */}
              {customer.walkIn ? (
                <span className="text-xs text-muted-foreground">{t('customers.readOnly')}</span>
              ) : (
                <>
                  <Button variant="ghost" size="icon" aria-label={t('customers.edit', { name: customer.name })}
                    title={t('customers.editTitle')} onClick={() => onEdit(customer)}>
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={t('customers.delete.open', { name: customer.name })}
                    title={t('customers.delete.confirm')} onClick={() => onDelete(customer)}
                    className="text-muted-foreground hover:text-destructive">
                    <Trash2 />
                  </Button>
                </>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/** Whether the customer has the fiscal data an invoice (CFDI) needs; the title shows it. */
function InvoiceStatus({ customer, className }: { customer: Customer, className?: string }) {
  const { t } = useTranslation()
  const invoiceable = isInvoiceable(customer)
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', invoiceable ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400', className)}
      title={invoiceable
        ? t('customers.fiscalSummary', { postalCode: customer.fiscalPostalCode, regime: customer.taxRegime })
        : t('customers.missingFiscalDataHint')}>
      {invoiceable ? <ReceiptText className="size-3.5" /> : <TriangleAlert className="size-3.5" />}
      {invoiceable ? t('customers.invoiceable') : t('customers.missingFiscalData')}
    </span>
  )
}
